import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SendMessageCommandInput,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { FifoBatchProcessor } from '../strategies/fifo'
import { StandardBatchProcessor } from '../strategies/standard'
import {
  Consumer,
  DXQueueMessage,
  BatchProcessor,
  Publisher,
} from '../interfaces'
import { SQSBackendConfig } from './sqs.config'
import { MessageAttributeValue } from '@aws-sdk/client-sqs/dist-types/models/models_0'
import { Fn, MessageConfig } from '../initialization/config'
import {
  getTraceAsMessageAttributes,
  runInTraceContextPropagatedFromBaggageInMessageAttributes,
  wrapInTracer,
} from '../trace/datadog'

export class SqsConsumer<P extends any[]> implements Consumer {
  private readonly sqs = this.backendConfig.sqsClient ?? new SQSClient({})

  private readonly isFifo: boolean
  private readonly batchProcessor: BatchProcessor

  constructor(
    private readonly processPayload: Fn<P>,
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: SQSBackendConfig<P>,
  ) {
    this.isFifo = backendConfig.queueUrl.endsWith('.fifo')
    this.batchProcessor = this.isFifo
      ? new FifoBatchProcessor()
      : new StandardBatchProcessor()
  }

  async consume() {
    try {
      const { Messages } = await this.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: this.backendConfig.queueUrl,
          MaxNumberOfMessages: this.backendConfig.maxNumberOfMessages ?? 10,
          WaitTimeSeconds: this.backendConfig.waitTimeSeconds ?? 5,
          VisibilityTimeout: this.backendConfig.visibilityTimeoutSeconds,
          AttributeNames: ['All'],
          MessageAttributeNames: ['All'],
        }),
      )

      if (!Messages) {
        return
      }

      const messages = Messages.map(
        (message) =>
          new DXQueueMessageSQSWrapper<P>(
            this.processPayload,
            this.messageConfig,
            this.backendConfig,
            this.sqs,
            message,
          ),
      )

      await this.batchProcessor.processMessages(messages)
    } catch (error) {
      await (this.backendConfig.onReceiveMessageError ?? console.error)(error)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (this.backendConfig.waitTimeSeconds ?? 5)),
      )
    }
  }
}

class DXQueueMessageSQSWrapper<P extends any[]> implements DXQueueMessage {
  readonly groupId = this.message.Attributes?.MessageGroupId

  constructor(
    private readonly processPayload: Fn<P>,
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: SQSBackendConfig<P>,
    private readonly sqs: SQSClient,
    private readonly message: Message,
  ) {}

  async process(): Promise<void> {
    await runInTraceContextPropagatedFromBaggageInMessageAttributes(
      async () => {
        await this.processPayload(
          ...this.messageConfig.decode(this.message.Body!),
        )
        await this.sqs.send(
          new DeleteMessageCommand({
            QueueUrl: this.backendConfig.queueUrl,
            ReceiptHandle: this.message.ReceiptHandle,
          }),
        )
      },
      this.message.MessageAttributes,
    )
  }

  async error(error: Error) {
    await runInTraceContextPropagatedFromBaggageInMessageAttributes(
      async () => {
        const promises: (void | Promise<void | any>)[] = []
        if (this.backendConfig.onProcessingError) {
          promises.push(
            this.backendConfig.onProcessingError({
              message: this.message,
              error,
              params: this.messageConfig.decode(this.message.Body!),
            }),
          )
        }
        if (this.backendConfig.visibilityTimeoutSeconds) {
          promises.push(
            this.sqs.send(
              new ChangeMessageVisibilityCommand({
                QueueUrl: this.backendConfig.queueUrl,
                ReceiptHandle: this.message.ReceiptHandle,
                VisibilityTimeout: 0,
              }),
            ),
          )
        }
        await Promise.all(promises)
      },
      this.message.MessageAttributes,
    )
  }
}

export class SqsProducer<P extends any[]> implements Publisher<P> {
  private readonly sqs = this.backendConfig.sqsClient ?? new SQSClient({})

  private readonly createSendMessageCommandInput: (
    params: P,
  ) => SendMessageCommandInput

  constructor(
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: SQSBackendConfig<P>,
  ) {
    const isFifo = backendConfig.queueUrl.endsWith('.fifo')

    if (isFifo) {
      if (
        this.backendConfig.getDeduplicationId &&
        this.backendConfig.getGroupId
      ) {
        this.createSendMessageCommandInput = (params: P) => ({
          MessageBody: this.messageConfig.encode(params),
          QueueUrl: this.backendConfig.queueUrl,
          MessageAttributes: getTraceAsMessageAttributes(),
          MessageDeduplicationId: this.backendConfig.getDeduplicationId!(
            ...params,
          ),
          MessageGroupId: this.backendConfig.getGroupId!(...params),
        })
      } else {
        throw new Error(
          'FIFO queue requires getDeduplicationId and getGroupId.',
        )
      }
    } else {
      this.createSendMessageCommandInput = (params: P) => ({
        MessageBody: this.messageConfig.encode(params),
        QueueUrl: this.backendConfig.queueUrl,
        MessageAttributes: getTraceAsMessageAttributes(),
        DelaySeconds: this.backendConfig.delaySeconds,
      })
    }
  }

  private async _publish(...params: P) {
    const sendMessageCommandInput = this.createSendMessageCommandInput(params)

    if (this.backendConfig.createMessageAttributes) {
      sendMessageCommandInput.MessageAttributes = Object.assign(
        sendMessageCommandInput.MessageAttributes ?? {},
        this.backendConfig
          .createMessageAttributes(...params)
          .reduce((acc, value) => {
            const messageAttributeValue: MessageAttributeValue = {
              DataType: value.DataType,
            }
            if (value.DataType === 'String' || value.DataType === undefined) {
              messageAttributeValue.StringValue = value.Value.toString()
            } else if (value.DataType === 'Binary') {
              messageAttributeValue.BinaryValue = value.Value
            }
            acc[value.Name] = messageAttributeValue
            return acc
          }, {} as Record<string, MessageAttributeValue>),
      )
    }

    const output = await this.sqs.send(
      new SendMessageCommand(sendMessageCommandInput),
    )

    await this.backendConfig.onMessageSent?.({
      output,
      params,
      input: sendMessageCommandInput,
    })
  }

  readonly publish = wrapInTracer(this._publish)
}

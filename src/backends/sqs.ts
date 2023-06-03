import { Message, SendMessageCommandInput, SQS } from '@aws-sdk/client-sqs'
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
  propagateTraceBaggage,
  runInTraceContextPropagatedFromBaggageInMessageAttributes,
  wrapInTracer,
} from '../trace/datadog'

export class SqsConsumer<P extends any[]> implements Consumer {
  private readonly sqs = this.backendConfig.sqsClient ?? new SQS({})

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
      const { Messages } = await this.sqs.receiveMessage({
        QueueUrl: this.backendConfig.queueUrl,
        MaxNumberOfMessages: this.backendConfig.maxNumberOfMessages ?? 10,
        WaitTimeSeconds: this.backendConfig.waitTimeSeconds ?? 5,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All'],
      })

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
    private readonly sqs: SQS,
    private readonly message: Message,
  ) {}

  async process(): Promise<void> {
    await runInTraceContextPropagatedFromBaggageInMessageAttributes(
      async () => {
        await this.processPayload(
          ...this.messageConfig.decode(this.message.Body!),
        )
        await this.sqs.deleteMessage({
          QueueUrl: this.backendConfig.queueUrl,
          ReceiptHandle: this.message.ReceiptHandle,
        })
      },
      this.message.MessageAttributes,
    )
  }

  async error(error: Error) {
    await runInTraceContextPropagatedFromBaggageInMessageAttributes(
      () =>
        this.backendConfig.onProcessingError?.({
          message: this.message,
          error,
          params: this.messageConfig.decode(this.message.Body!),
        }),
      this.message.MessageAttributes,
    )
  }
}

export class SqsProducer<P extends any[]> implements Publisher<P> {
  private readonly sqs = this.backendConfig.sqsClient ?? new SQS({})

  private readonly isFifo: boolean

  private readonly createNewMessageAttributes: (params: P) => {
    [key: string]: MessageAttributeValue
  }

  constructor(
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: SQSBackendConfig<P>,
  ) {
    this.isFifo = backendConfig.queueUrl.endsWith('.fifo')
    if (this.isFifo) {
      if (
        this.backendConfig.getDeduplicationId &&
        this.backendConfig.getGroupId
      ) {
        this.createNewMessageAttributes = (params) =>
          Object.assign(
            {
              MessageDeduplicationId: this.backendConfig.getDeduplicationId!(
                ...params,
              ),
              MessageGroupId: this.backendConfig.getGroupId!(...params),
            },
            propagateTraceBaggage() ?? {},
          )
      } else {
        throw new Error(
          'FIFO queue requires getDeduplicationId and getGroupId.',
        )
      }
    } else {
      this.createNewMessageAttributes = (_) => propagateTraceBaggage() ?? {}
    }
  }

  private async _publish(...params: P) {
    const sendMessageCommandInput: SendMessageCommandInput = {
      MessageBody: this.messageConfig.encode(params),
      QueueUrl: this.backendConfig.queueUrl,
      MessageAttributes: this.createNewMessageAttributes(params),
    }

    if (!this.isFifo) {
      sendMessageCommandInput.DelaySeconds = this.backendConfig.delaySeconds
    }

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

    const output = await this.sqs.sendMessage(sendMessageCommandInput)

    await this.backendConfig.onMessageSent?.({ output, params })
  }

  readonly publish = wrapInTracer(this._publish)
}

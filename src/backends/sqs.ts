import {
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
import { Fn, MessageConfig } from '../initialization/config'

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

  /**
   * Consume messages from the queue
   * @returns the number of messages consumed
   */
  async consume() {
    try {
      const { Messages } = await this.sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: this.backendConfig.queueUrl,
          MaxNumberOfMessages: this.backendConfig.maxNumberOfMessages,
          WaitTimeSeconds: this.backendConfig.waitTimeSeconds,
          VisibilityTimeout: this.backendConfig.visibilityTimeoutSeconds,
          AttributeNames: ['All'],
          MessageAttributeNames: ['All'],
        }),
      )

      if (!Messages) {
        return 0
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
      return Messages.length
    } catch (error) {
      await (this.backendConfig.onReceiveMessageError ?? console.error)(error)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (this.backendConfig.waitTimeSeconds ?? 5)),
      )
      return 0
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
    if (this.backendConfig.consumerWrapper) {
      await this.backendConfig.consumerWrapper(this.message, () =>
        this._process(),
      )
    } else {
      await this._process()
    }
  }

  private async _process(): Promise<void> {
    await this.processPayload(...this.messageConfig.decode(this.message.Body!))
    await this.sqs.send(
      new DeleteMessageCommand({
        QueueUrl: this.backendConfig.queueUrl,
        ReceiptHandle: this.message.ReceiptHandle,
      }),
    )
  }

  async error(error: Error) {
    if (this.backendConfig.consumerWrapper) {
      await this.backendConfig.consumerWrapper(this.message, () =>
        this._error(error),
      )
    } else {
      await this._error(error)
    }
  }

  private async _error(error: Error) {
    await this.backendConfig.onProcessingError?.({
      message: this.message,
      error,
      params: this.messageConfig.decode(this.message.Body!),
    })
  }

  async finally() {
    if (this.backendConfig.consumerWrapper) {
      await this.backendConfig.consumerWrapper(this.message, () =>
        this._finally(),
      )
    } else {
      await this._finally()
    }
  }

  private async _finally() {
    await this.backendConfig.onProcessingFinally?.({
      message: this.message,
      params: this.messageConfig.decode(this.message.Body!),
    })
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
      if (this.backendConfig.createGroupId) {
        this.createSendMessageCommandInput = (params: P) => ({
          MessageBody: this.messageConfig.encode(params),
          QueueUrl: this.backendConfig.queueUrl,
          MessageDeduplicationId: this.backendConfig.createDeduplicationId?.(
            ...params,
          ),
          MessageGroupId: this.backendConfig.createGroupId!(...params),
          MessageAttributes: this.backendConfig.createMessageAttributes?.(
            ...params,
          ),
        })
      } else {
        throw new Error('FIFO queue requires createGroupId.')
      }
    } else {
      this.createSendMessageCommandInput = (params: P) => ({
        MessageBody: this.messageConfig.encode(params),
        QueueUrl: this.backendConfig.queueUrl,
        DelaySeconds: this.backendConfig.delaySeconds,
        MessageAttributes: this.backendConfig.createMessageAttributes?.(
          ...params,
        ),
      })
    }
  }

  async publish(...params: P) {
    const sendMessageCommandInput = this.createSendMessageCommandInput(params)

    const output = await this.sqs.send(
      new SendMessageCommand(sendMessageCommandInput),
    )

    await this.backendConfig.onMessageSent?.({
      output,
      params,
      input: sendMessageCommandInput,
    })
  }
}

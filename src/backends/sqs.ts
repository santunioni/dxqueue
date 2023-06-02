import { Message, SendMessageCommandInput, SQS } from '@aws-sdk/client-sqs'
import { FifoBatchProcessor } from '../strategies/fifo'
import { StandardBatchProcessor } from '../strategies/standard'
import {
  Consumer,
  DXQueueMessage,
  BatchProcessor,
  Publisher,
  Logger,
} from '../interfaces'
import { defaultGetGroupId, hashCode } from '../initialization/defaults'
import { SQSBackendConfig } from './sqs.config'
import { MessageAttributeValue } from '@aws-sdk/client-sqs/dist-types/models/models_0'

export class SqsConsumer implements Consumer {
  private readonly sqs = new SQS(this.backendConfig.sqsClientConfig ?? {})

  private readonly isFifo: boolean
  private readonly batchProcessor: BatchProcessor

  constructor(
    private readonly processPayload: (payload: string) => Promise<void>,
    private readonly logger: Logger,
    private readonly backendConfig: SQSBackendConfig<any>,
  ) {
    this.isFifo = backendConfig.queueUrl.endsWith('.fifo')
    this.batchProcessor = this.isFifo
      ? new FifoBatchProcessor()
      : new StandardBatchProcessor()
  }

  async consume() {
    const { Messages } = await this.sqs.receiveMessage({
      QueueUrl: this.backendConfig.queueUrl,
      MaxNumberOfMessages: this.backendConfig.maxNumberOfMessages ?? 10,
      WaitTimeSeconds: this.backendConfig.waitTimeSeconds ?? 5,
      AttributeNames: ['All'],
    })

    if (!Messages) {
      return
    }

    const messages = Messages.map(
      (message) =>
        new DXQueueMessageSQSWrapper(
          this.processPayload,
          this.backendConfig.queueUrl,
          message,
          this.sqs,
          this.logger,
        ),
    )

    await this.batchProcessor.processMessages(messages)
  }
}

class DXQueueMessageSQSWrapper implements DXQueueMessage {
  readonly groupId = this.message.Attributes?.MessageGroupId

  constructor(
    private readonly processPayload: (payload: string) => Promise<void>,
    private readonly queueUrl: string,
    private readonly message: Message,
    private readonly sqs: SQS,
    private readonly logger: Logger,
  ) {
    this.logger.debug('Message received', {
      QueueUrl: this.queueUrl,
      MessageId: this.message.MessageId,
      Attributes: this.message.Attributes,
      ReceiptHandle: this.message.ReceiptHandle,
    })
  }

  async process(): Promise<void> {
    await this.processPayload(this.message.Body!)
  }

  async ack(): Promise<void> {
    await this.sqs.deleteMessage({
      QueueUrl: this.queueUrl,
      ReceiptHandle: this.message.ReceiptHandle,
    })
    this.logger.debug('Message deleted', {
      QueueUrl: this.queueUrl,
      MessageId: this.message.MessageId,
      Attributes: this.message.Attributes,
      ReceiptHandle: this.message.ReceiptHandle,
    })
  }

  async error(error: any): Promise<void> {
    this.logger.error('Error processing message', {
      error,
      QueueUrl: this.queueUrl,
      Body: this.message.Body,
      MessageId: this.message.MessageId,
      Attributes: this.message.Attributes,
      ReceiptHandle: this.message.ReceiptHandle,
    })
  }
}

export class SqsProducer<P extends any[]> implements Publisher<P> {
  private readonly sqs = new SQS(this.backendConfig.sqsClientConfig ?? {})

  private readonly isFifo: boolean
  private readonly getGroupId: (...params: P) => string

  constructor(
    private readonly logger: Logger,
    private readonly encoder: (params: P) => string,
    private readonly backendConfig: SQSBackendConfig<P>,
  ) {
    this.getGroupId = backendConfig.getGroupId ?? defaultGetGroupId
    this.isFifo = backendConfig.queueUrl.endsWith('.fifo')
    if (this.isFifo && this.getGroupId === defaultGetGroupId) {
      this.logger.warn(
        'You should define message.getGroupId for fifo queues to guarantee ordering for messages within the same logical group. Defaulting to ordering all messages, which is low performance.',
      )
    }
  }

  private getDeduplicationId(params: P) {
    return hashCode(this.encoder(params)).toString(16)
  }

  async publish(...params: P) {
    const sendMessageCommandInput: SendMessageCommandInput = {
      MessageBody: this.encoder(params),
      QueueUrl: this.backendConfig.queueUrl,
    }

    if (this.isFifo) {
      Object.assign(sendMessageCommandInput, {
        MessageDeduplicationId: this.getDeduplicationId(params),
        MessageGroupId: this.getGroupId(...params),
      } as SendMessageCommandInput)
    } else {
      Object.assign(sendMessageCommandInput, {
        DelaySeconds: this.backendConfig.delaySeconds,
      } as SendMessageCommandInput)
    }

    if (this.backendConfig.createMessageAttributes) {
      Object.assign(sendMessageCommandInput, {
        MessageAttributes: this.backendConfig
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
      } as SendMessageCommandInput)
    }

    const output = await this.sqs.sendMessage(sendMessageCommandInput)

    await this.backendConfig.onMessageSent?.({ output, params })
  }
}

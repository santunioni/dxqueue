import {
  Message,
  ReceiveMessageCommandInput,
  SendMessageCommandInput,
  SQS,
} from '@aws-sdk/client-sqs'
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

export class SqsConsumer implements Consumer {
  private readonly sqs = new SQS(this.backendConfig.config ?? {})

  private readonly isFifo: boolean
  private readonly batchProcessor: BatchProcessor

  constructor(
    processPayload: (payload: string) => Promise<void>,
    private readonly logger: Logger,
    private readonly backendConfig: SQSBackendConfig,
  ) {
    this.isFifo = backendConfig.url.endsWith('.fifo')
    this.batchProcessor = this.isFifo
      ? new FifoBatchProcessor(processPayload)
      : new StandardBatchProcessor(processPayload)
  }

  async consume() {
    const { Messages } = await this.sqs.receiveMessage({
      QueueUrl: this.backendConfig.url,
      MaxNumberOfMessages: this.backendConfig.maxNumberOfMessages ?? 10,
      WaitTimeSeconds: this.backendConfig.waitTimeSeconds ?? 5,
      ...(this.isFifo
        ? ({
            AttributeNames: ['MessageGroupId'],
          } as ReceiveMessageCommandInput)
        : {}),
    })

    if (!Messages) {
      return
    }

    const messages = Messages.map(
      (message) =>
        new DXQueueMessageSQSWrapper(
          this.backendConfig.url,
          message,
          this.sqs,
          this.logger,
        ),
    )

    await this.batchProcessor.processMessages(messages)
  }
}

class DXQueueMessageSQSWrapper implements DXQueueMessage {
  readonly payload = this.message.Body!
  readonly groupId = this.message.Attributes?.MessageGroupId

  constructor(
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
  private readonly sqs = new SQS(this.backendConfig.config ?? {})

  private readonly isFifo: boolean

  constructor(
    private readonly logger: Logger,
    private readonly encoder: (params: P) => string,
    private readonly getGroupId: (...params: P) => string,
    private readonly backendConfig: SQSBackendConfig,
  ) {
    this.isFifo = backendConfig.url.endsWith('.fifo')
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
    const receipt = await this.sqs.sendMessage({
      MessageBody: this.encoder(params),
      QueueUrl: this.backendConfig.url,
      ...(this.isFifo
        ? ({
            MessageDeduplicationId: this.getDeduplicationId(params),
            MessageGroupId: this.getGroupId(...params),
          } as SendMessageCommandInput)
        : {}),
    })
    this.logger.debug('Message sent', {
      MessageId: receipt.MessageId,
      $metadata: receipt.$metadata,
      SequenceNumber: receipt.SequenceNumber,
      QueueUrl: this.backendConfig.url,
    })
  }
}

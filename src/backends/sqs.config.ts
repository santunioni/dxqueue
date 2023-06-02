/**
 * This module is kept separate and use lazy import type hints to avoid requiring the @aws-sdk/client-sqs when not using SQS.
 */
import {
  Message,
  SendMessageCommandOutput,
  SQS,
  SQSClientConfig,
} from '@aws-sdk/client-sqs'

type DXQueueSQSBackendMessageAttribute =
  | {
      Name: string
      DataType?: 'String'
      Value: string | number
    }
  | {
      Name: string
      DataType: 'Binary'
      Value: Uint8Array
    }

export type SQSBackendConfig<
  P extends any[],
  Attributes extends DXQueueSQSBackendMessageAttribute[] = DXQueueSQSBackendMessageAttribute[],
> = {
  type: 'sqs'
  /**
   * The URL of the Amazon SQS queue to take action on.
   * @type import('@aws-sdk/client-sqs').ReceiveMessageCommandInput#QueueUrl
   */
  queueUrl: string

  /**
   * The Amazon SQS client configuration to use.
   */
  sqsClientConfig?: SQSClientConfig

  /**
   * The time in seconds for which the call waits for a message to arrive in the queue before returning.
   * @type import('@aws-sdk/client-sqs').ReceiveMessageCommandInput#WaitTimeSeconds
   */
  waitTimeSeconds?: number

  /**
   * The maximum number of messages to return. Amazon SQS never returns more messages than this value (however, fewer messages might be returned). Valid values: 1 to 10. Default: 1.
   * @type import('@aws-sdk/client-sqs').ReceiveMessageCommandInput#MaxNumberOfMessages
   */
  maxNumberOfMessages?: number

  /**
   * <p>
   *           The length of time, in seconds, for which to delay a specific message. Valid values: 0 to 900. Maximum: 15 minutes. Messages with a positive <code>DelaySeconds</code> value become available for processing after the delay period is finished.
   *           If you don't specify a value, the default value for the queue applies.
   *     </p>
   *          <note>
   *             <p>When you set <code>FifoQueue</code>, you can't set <code>DelaySeconds</code> per message. You can set this parameter only on a queue level.</p>
   *          </note>
   */
  delaySeconds?: number

  /**
   * @type import('@aws-sdk/client-sqs').SendMessageCommandInput#MessageAttributes
   */
  createMessageAttributes?: (...params: P) => Attributes

  /**
   * Used for FIFO queues, ignored for standard. The group id is used for ordering messages within a 5-minute period.
   * @param params the same params passed to the function wrapped in pubsub.
   */
  getGroupId?: (...params: P) => string

  /**
   * Used for FIFO queues, ignored for standard. The deduplication id is used for deduplication of messages within a 5-minute period.
   * Defaults to hashing the params.
   * @param params the same params passed to the function wrapped in pubsub.
   */
  getDeduplicationId?: (...params: P) => string

  onMessageSent?: (args: {
    params: P
    output: SendMessageCommandOutput
  }) => void | Promise<void>

  onProcessingError?: (args: {
    params: P
    error: Error
    message: Message
    sqs: SQS
  }) => void | Promise<void>
}

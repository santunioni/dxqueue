/**
 * This module is kept separate and use lazy import type hints to avoid requiring the @aws-sdk/client-sqs when not using SQS.
 */

const LazySQSModule = () => require('@aws-sdk/client-sqs').SQSClient

type SQSClientConfig = ConstructorParameters<
  ReturnType<typeof LazySQSModule>
>[0]

export type SQSBackendConfig<P extends any[]> = {
  type: 'sqs'
  /**
   * The URL of the Amazon SQS queue to take action on.
   * @type import('@aws-sdk/client-sqs').ReceiveMessageCommandInput#QueueUrl
   */
  url: string

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
}

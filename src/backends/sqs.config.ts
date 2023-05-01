/**
 * This module is kept separate and use lazy import type hints to avoid requiring the @aws-sdk/client-sqs when not using SQS.
 */

const LazySQSModule = () => require('@aws-sdk/client-sqs').SQSClient
type SQSClientConfig = ConstructorParameters<
  ReturnType<typeof LazySQSModule>
>[0]

export type SQSBackendConfig = {
  type: 'sqs'
  /**
   * The URL of the Amazon SQS queue to take action on.
   * @type import('@aws-sdk/client-sqs').ReceiveMessageCommandInput#QueueUrl
   */
  url: string
  /**
   * The Amazon SQS client configuration to use.
   */
  config?: SQSClientConfig
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
}

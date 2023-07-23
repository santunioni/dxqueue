const SQSModuleFactory = () => require('@aws-sdk/client-sqs')
type LazySQSModule = ReturnType<typeof SQSModuleFactory>

type Message = LazySQSModule['Message']
type SendMessageCommandInput = LazySQSModule['SendMessageCommandInput']
type SendMessageCommandOutput = LazySQSModule['SendMessageCommandOutput']
type MessageAttributeValue = LazySQSModule['MessageAttributeValue']

type SQSClient = LazySQSModule['SQSClient']

export type SQSBackendConfig<P extends unknown[]> = {
  type: 'sqs'
  /**
   * The URL of the Amazon SQS queue to take action on.
   */
  queueUrl: string

  /**
   * The Amazon SQS client configuration to use.
   */
  sqsClient?: SQSClient

  /**
   * The time in seconds for which the call waits for a message to arrive in the queue before returning.
   */
  waitTimeSeconds?: number

  /**
   * The maximum number of messages to return. Amazon SQS never returns more messages than this value (however, fewer messages might be returned). Valid values: 1 to 10. Default: 1.
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
   * The duration (in seconds) that the received messages are hidden from subsequent retrieve requests after being retrieved by a ReceiveMessage request. Values range: 0 to 43200. Maximum: 12 hours.
   */
  visibilityTimeoutSeconds?: number

  /**
   * @type SendMessageCommandInput#MessageAttributes
   */
  createMessageAttributes?: (
    ...params: P
  ) => Record<string, MessageAttributeValue>

  /**
   * Used for FIFO queues, ignored for standard. The messages with same groupId have ordering guaranteed.
   * @param params the same params passed to the function wrapped in pubsub.
   * @external SendMessageCommandInput#MessageGroupId
   */
  createGroupId?: (...params: P) => string

  /**
   * Used for FIFO queues, ignored for standard. The deduplication id is used for deduplication of messages within a 5-minute period.
   * @param params the same params passed to the function wrapped in pubsub.
   * @external SendMessageCommandInput#MessageDeduplicationId
   */
  createDeduplicationId?: (...params: P) => string

  onMessageSent?: (args: {
    params: P
    output: SendMessageCommandOutput
    input: SendMessageCommandInput
  }) => void | Promise<void>

  onProcessingError?: (args: {
    params: P
    error: Error
    message: Message
  }) => void | Promise<void>

  onReceiveMessageError?: (error: unknown) => void | Promise<void>

  consumerWrapper?: (
    message: Message,
    callback: () => Promise<void> | void,
  ) => Promise<void> | void
}

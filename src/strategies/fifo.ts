import { BatchProcessor, DXQueueMessage } from '../interfaces'
import { SerialBatchProcessor } from './serial'

/**
 * Process messages with same MessageGroupId in order, but process messages with different MessageGroupId in parallel.
 * Skip messages with the same MessageGroupId if a preceding message fails.
 * @param Messages
 * @private
 */
export class FifoBatchProcessor implements BatchProcessor {
  private readonly serialBatchProcessor: SerialBatchProcessor

  constructor(processPayload: (payload: string) => Promise<void> | void) {
    this.serialBatchProcessor = new SerialBatchProcessor(processPayload)
  }

  async processMessages(messages: DXQueueMessage[]) {
    const messagesByGroupId = messages.reduce((acc, message) => {
      const groupId: string = message.groupId ?? 'default'
      acc.set(groupId, [...(acc.get(groupId) ?? []), message])
      return acc
    }, new Map<string, DXQueueMessage[]>())

    await Promise.all(
      [...messagesByGroupId.values()].map((messagesWithSameGroupId) =>
        this.serialBatchProcessor.processMessages(messagesWithSameGroupId),
      ),
    )
  }
}

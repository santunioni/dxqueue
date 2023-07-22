import { BatchProcessor, DXQueueMessage } from '../interfaces'

/**
 * Process messages in order. Failure of a message will cause all subsequent messages to fail.
 */
export class SerialBatchProcessor implements BatchProcessor {
  async processMessages(messages: DXQueueMessage[]) {
    for (const [index, message] of messages.entries()) {
      try {
        await message.process()
      } catch (error) {
        await Promise.all(
          messages.slice(index).map((message) => message.error(error)),
        )
        break
      }
    }
  }
}

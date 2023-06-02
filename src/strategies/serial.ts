import { BatchProcessor, DXQueueMessage } from '../interfaces'

/**
 * Process messages in order. Failure of a message will cause all subsequent messages to fail.
 */
export class SerialBatchProcessor implements BatchProcessor {
  constructor() {}

  async processMessages(messages: DXQueueMessage[]) {
    while (messages.length > 0) {
      const message = messages.shift()!
      try {
        await message.process()
        await message.ack()
      } catch (error) {
        await message.error(error)
        break
      }
    }

    await Promise.all(
      messages.map((message) =>
        message.error(new Error('Message skipped because a previous failure.')),
      ),
    )
  }
}

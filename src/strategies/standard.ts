import { BatchProcessor, DXQueueMessage } from '../interfaces'

/**
 * Process messages in parallel.
 * @param Messages
 * @private
 */
export class StandardBatchProcessor implements BatchProcessor {
  async processMessages(Messages: DXQueueMessage[]) {
    await Promise.all(
      Messages.map(async (message) => {
        try {
          await message.process()
        } catch (error) {
          await message.error(error)
        }
      }),
    )
  }
}

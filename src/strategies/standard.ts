import { BatchProcessor, DXQueueMessage } from '../interfaces'

/**
 * Process messages in parallel.
 * @param Messages
 * @private
 */
export class StandardBatchProcessor implements BatchProcessor {
  constructor(
    private readonly processPayload: (payload: string) => Promise<void> | void,
  ) {}

  async processMessages(Messages: DXQueueMessage[]) {
    await Promise.all(
      Messages.map(async (message) => {
        try {
          await this.processPayload(message.payload)
          await message.ack()
        } catch (error) {
          await message.error(error)
        }
      }),
    )
  }
}

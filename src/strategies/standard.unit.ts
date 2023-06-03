import { DXQueueMessage } from '../interfaces'
import { StandardBatchProcessor } from './standard'

describe('StandardStrategy', () => {
  it('should process all sucessfull messages on batch even if one fails', async () => {
    // Given the first message from groupId=1 fails
    const messages: DXQueueMessage[] = [
      {
        process: jest.fn(async () => {
          throw new Error('Failed')
        }),
        error: jest.fn(),
        groupId: '1',
      },
      {
        process: jest.fn(),
        error: jest.fn(),
        groupId: '2',
      },
      {
        process: jest.fn(),
        error: jest.fn(),
        groupId: '1',
      },
    ]

    // When: the standard strategy is used to batch process messages
    const strategy = new StandardBatchProcessor()
    await strategy.processMessages(messages)

    // Then: subscriber should process the first message for group groupId=1 and skip the rest, and process all messages for groupId=2
    expect(messages[0].process).toHaveBeenCalled()
    expect(messages[0].error).toHaveBeenCalled()

    expect(messages[1].process).toHaveBeenCalled()
    expect(messages[1].error).not.toHaveBeenCalled()

    expect(messages[2].process).toHaveBeenCalled()
    expect(messages[2].error).not.toHaveBeenCalled()
  })
})

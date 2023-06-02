import { FifoBatchProcessor } from './fifo'
import { DXQueueMessage } from '../interfaces'

describe('FifoStrategy', () => {
  it('should not process consecutive messages of same group if the first message fails', async () => {
    // Given the first message from groupId=1 fails
    const messages: DXQueueMessage[] = [
      {
        process: jest.fn(async () => {
          throw new Error('Failed')
        }),
        error: jest.fn(),
        groupId: '1',
        ack: jest.fn(),
      },
      {
        process: jest.fn(),
        error: jest.fn(),
        groupId: '2',
        ack: jest.fn(),
      },
      {
        process: jest.fn(),
        error: jest.fn(),
        groupId: '1',
        ack: jest.fn(),
      },
    ]

    // When the fifo strategy is used to batch process messages
    const strategy = new FifoBatchProcessor()
    await strategy.processMessages(messages)

    // Then: subscriber should process the first message for group groupId=1 and skip the other, and process all messages for groupId=2
    expect(messages[0].process).toHaveBeenCalled()
    expect(messages[0].error).toHaveBeenCalled()

    expect(messages[1].process).toHaveBeenCalled()
    expect(messages[1].error).not.toHaveBeenCalled()

    expect(messages[2].process).not.toHaveBeenCalled()
    expect(messages[2].error).toHaveBeenCalled()
  })
})

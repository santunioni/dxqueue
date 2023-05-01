import { FifoBatchProcessor } from './fifo'
import { DXQueueMessage } from '../interfaces'

describe('FifoStrategy', () => {
  it('should not process consecutive messages of same group if the first message fails', async () => {
    const consumePayload = jest.fn((payload: string) => {
      if (payload.includes('error')) throw new Error()
    })
    const error = jest.fn()

    // When the first message from groupId=1 fails
    const messages: DXQueueMessage[] = [
      {
        payload: 'error from groupId=1',
        error,
        groupId: '1',
        ack: jest.fn(),
      },
    ]
    for (let i = 0; i < 3; i++) {
      messages.push({
        payload: 'message from groupId=2',
        error,
        groupId: '2',
        ack: jest.fn(),
      })
      messages.push({
        payload: 'message from groupId=1',
        error,
        groupId: '1',
        ack: jest.fn(),
      })
    }
    const strategy = new FifoBatchProcessor(consumePayload)
    await strategy.processMessages(messages)

    // Then: subscriber should process the first message for group groupId=1 and skip the rest, and process all messages for groupId=2
    const calls = consumePayload.mock.calls
    expect(
      calls.filter(([payload]) => payload.includes('groupId=1')),
    ).toHaveLength(1)
    expect(
      calls.filter(([payload]) => payload.includes('groupId=2')),
    ).toHaveLength(3)

    expect(error).toHaveBeenCalled()
  })
})

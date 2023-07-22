import { wrapFunctionInQueue } from './function'
import { Consumer } from './interfaces'

describe('wrapped function performIntensiveWork', () => {
  let performIntensiveWork: (
    param1: number,
    param2: {
      c: number
      d: string
    },
  ) => Promise<void>
  let wrapped: typeof performIntensiveWork
  let consumer: Consumer

  beforeEach(async () => {
    // Given the function is wrapped on pubsub
    performIntensiveWork = jest.fn()
    ;({ wrapped, consumer } = wrapFunctionInQueue(performIntensiveWork, {
      backend: {
        type: 'array',
        queue: [],
      },
    }))
  })

  it('should only be called by the consumer', async () => {
    // When: publisher is called
    await wrapped(1, {
      c: 2,
      d: '3',
    })

    // Then: the function is not called
    expect(performIntensiveWork).not.toHaveBeenCalled()
  })

  it('should be called by the consumer', async () => {
    // Given: publisher is called
    await wrapped(1, {
      c: 2,
      d: '3',
    })

    // When: the consumer runs
    await consumer.consume()

    // Then: the function is called
    expect(performIntensiveWork).toHaveBeenCalledWith(1, {
      c: 2,
      d: '3',
    })
  })
})

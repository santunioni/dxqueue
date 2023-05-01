import {
  getConsumerFromInstanceMethod,
  getConsumersFromInstance,
  Queue,
} from './decorator'

class Domain {
  constructor(
    private readonly something: (message: string, userId: number) => void,
  ) {}

  @Queue<Domain, 'doSomething'>(() => ({
    backend: {
      type: 'mock',
      queue: [],
    },
  }))
  public async doSomething(userId: number, message: string) {
    this.something(message, userId)
  }

  @Queue<Domain, 'doNothing'>(() => ({
    backend: {
      type: 'mock',
      queue: [],
    },
  }))
  public async doNothing() {}
}

describe('decorator', () => {
  it('should not call performExpensiveWork directly', async () => {
    // Given a method is decorated with @Queue
    const performExpensiveWork = jest.fn()
    const domain = new Domain(performExpensiveWork)

    // When the method is called
    await domain.doSomething(1, 'test')

    // Then method code should not be executed
    expect(performExpensiveWork).toHaveBeenCalledTimes(0)
  })

  it('should call performExpensiveWork when consume', async () => {
    // Given a method decorated with @Queue is called
    const performExpensiveWork = jest.fn()
    const domain = new Domain(performExpensiveWork)
    await domain.doSomething(1, 'test')

    // When the consumer is executed
    const consumer = getConsumerFromInstanceMethod(domain, 'doSomething')
    await consumer.consume()

    // Then method code should be executed
    expect(performExpensiveWork).toHaveBeenCalledTimes(1)
    expect(performExpensiveWork).toHaveBeenCalledWith('test', 1)
  })

  it('should find 2 subscribers on the class with 2 decorated methods', () => {
    expect(getConsumersFromInstance(new Domain(jest.fn()))).toHaveLength(2)
  })

  it('should not find any subscribers on a class with no decorated methods', () => {
    expect(getConsumersFromInstance(new Set())).toHaveLength(0)
  })
})

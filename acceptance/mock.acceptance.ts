import { DomainExampleClass } from './fixtures'

afterAll(() => {
  delete process.env.DXQUEUE_BYPASS_QUEUE_BACKEND
})

describe('MockedPublisher', () => {
  it('should bypass queue backend when environment variable DXQUEUE_BYPASS_QUEUE_BACKEND is set', async () => {
    // Given the env var DXQUEUE_BYPASS_QUEUE_BACKEND is set
    process.env.DXQUEUE_BYPASS_QUEUE_BACKEND = 'true'
    const doSomethingInnerCode = jest.fn()
    const domain = new DomainExampleClass(doSomethingInnerCode)

    // When it is called
    await domain.doSomething('my', 2)

    // Then the method inner code should execute
    expect(doSomethingInnerCode).toHaveBeenCalledWith('my', 2)
  })
})

import { getConsumersFromInstance, Looper, Queue } from '../dist'
import { SQS } from '@aws-sdk/client-sqs'
import { DomainExampleClass } from './fixtures'

let sqsClient: SQS
let queueUrl: string

beforeEach(async () => {
  const queueName = `dxqueue-test-${Math.floor(Math.random() * 10 ** 12)}`
  sqsClient = new SQS({
    endpoint: 'http://localhost:4566',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  })
  queueUrl = await sqsClient
    .createQueue({
      QueueName: queueName,
    })
    .then((res) => res.QueueUrl!)
})

afterEach(async () => {
  await sqsClient.deleteQueue({
    QueueUrl: queueUrl,
  })
})

describe('DXQueue', () => {
  it('should publish message instead of calling method', async () => {
    // Given a method decorated with @Queue
    const doSomethingInnerCode = jest.fn()
    const domain = new DomainExampleClass(
      doSomethingInnerCode,
      queueUrl,
      sqsClient,
    )

    // When the method is called
    await domain.doSomething('my', 1)

    // Then its inner code should not be executed
    expect(doSomethingInnerCode).not.toHaveBeenCalled()
  })

  it('should call method when consumer runs', async () => {
    // Given a method decorated with @Queue is called
    const doSomethingInnerCode = jest.fn()
    const domain = new DomainExampleClass(
      doSomethingInnerCode,
      queueUrl,
      sqsClient,
    )
    await domain.doSomething('my', 2)

    // When the consumer runs
    const abortController = new AbortController()
    setTimeout(() => abortController.abort(), 100)

    const loops = getConsumersFromInstance(domain).map((consumer) =>
      new Looper(consumer).start(abortController.signal),
    )
    await Promise.all(loops)

    // Then the method inner code should execute
    expect(doSomethingInnerCode).toHaveBeenCalledWith('my', 2)
  })
})

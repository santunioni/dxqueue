import { getConsumersFromInstance, Looper, Queue } from '../src'
import { SQS } from '@aws-sdk/client-sqs'

const sqsConfig = {
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
}

let queueUrl: string

beforeEach(async () => {
  const queueName = `dxqueue-test-${Math.floor(Math.random() * 10 ** 12)}`
  queueUrl = await new SQS(sqsConfig)
    .createQueue({
      QueueName: queueName,
    })
    .then((res) => res.QueueUrl!)
})

afterEach(async () => {
  await new SQS(sqsConfig).deleteQueue({
    QueueUrl: queueUrl,
  })
})

class Domain {
  constructor(
    private readonly queueUrl: string,
    private readonly doSomethingInnerCode: (my: string, arg: number) => void,
  ) {}

  @Queue<Domain, 'doSomething'>((self) => ({
    backend: {
      type: 'sqs',
      config: sqsConfig,
      url: self.queueUrl,
      waitTimeSeconds: 0,
    },
  }))
  async doSomething(my: string, arg: number) {
    this.doSomethingInnerCode(my, arg)
  }
}

describe('DXQueue', () => {
  it('should publish message instead of calling method', async () => {
    // Given a method decorated with @Queue
    const doSomethingInnerCode = jest.fn()
    const domain = new Domain(queueUrl, doSomethingInnerCode)

    // When the method is called
    await domain.doSomething('my', 1)

    // Then its inner code should not be executed
    expect(doSomethingInnerCode).not.toHaveBeenCalled()
  })

  it('should call method when consumer runs', async () => {
    // Given a method decorated with @Queue is called
    const doSomethingInnerCode = jest.fn()
    const domain = new Domain(queueUrl, doSomethingInnerCode)
    await domain.doSomething('my', 2)

    // When the consumer runs
    const abortController = new AbortController()
    setTimeout(() => abortController.abort(), 100)

    const loops = getConsumersFromInstance(domain).map((consumer) =>
      new Looper(consumer).startLoop(abortController.signal),
    )
    await Promise.all(loops)

    // Then the method inner code should execute
    expect(doSomethingInnerCode).toHaveBeenCalledWith('my', 2)
  })
})

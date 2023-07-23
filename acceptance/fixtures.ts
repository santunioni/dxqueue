import { SQS } from '@aws-sdk/client-sqs'
import { Queue } from '../dist'

export class DomainExampleClass {
  constructor(
    private readonly doSomethingInnerCode: (my: string, arg: number) => void,
    private readonly queueUrl: string = 'http://localhost:4566/queue/test',
    private readonly sqsClient: SQS = new SQS({}),
  ) {}

  @Queue<DomainExampleClass, 'doSomething'>((self) => ({
    backend: {
      type: 'sqs',
      sqsClient: self.sqsClient,
      queueUrl: self.queueUrl,
      waitTimeSeconds: 0,
    },
  }))
  async doSomething(my: string, arg: number) {
    this.doSomethingInnerCode(my, arg)
  }
}

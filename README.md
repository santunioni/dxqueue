# Dxqueue

## Developer Experience Focused Queue Framework

A minimalistic nodejs queue framework built with developer experience in mind.
Dxqueue helps you leverage messaging backends to call your code in a separate worker.
This is called async processing since the old days.

With Dxqueue you can define infrastructure boundaries to meet your scaling requirements,
while not being forced to accomodate your logical boundaries to your infrastructure.
If the messaging consumer code and producer code are within the same bounded context,
keeping them together is the best idea.

Check [this video](https://www.youtube.com/watch?v=BFcxgcoO5Ns) from CodeOpinion to understand the differences
between physical and logical boundaries.

This is really useful for implementing the Remote Command pattern.

## Usage

### Installation

Install the framework

```bash
npm install dxqueue
```

Install your backend of choice. Currently only SQS is supported.

```bash
npm install @aws-sdk/client-sqs
```

### Decorate your domain class methods that should get delayed by the queue

```typescript
// file: domain.ts

import { Queue } from '@santunioni/dxqueue'

export class Domain {
  constructor(private readonly queueUrl: string) {}

  @Queue<Domain, 'doSomething'>((self) => ({
    backend: {
      type: 'sqs',
      url: self.queueUrl,
    },
    message: {
      getGroupId: (my, arg) => my, // <-- Leverage type inference
    },
  }))
  async doSomething(my: string, arg: number) {
    // doing some heavy work that gets delayed through the Queue ...
  }
}
```

### Call the method from the client

Your method calls will publish to the queue.

```typescript
// file: client.ts

import { Domain } from './domain'

const domain = new Domain('http://localhost:4566/000000000000/my-queue')
await domain.doSomething('my', 1) // <-- This will publish to the Queue instead of calling the method directly
```

### Create a worker

The worker will consume the queue to call the original method implementation.

```typescript
// file: worker.ts

import { getConsumersFromInstance, Looper } from '@santunioni/dxqueue'
import { Domain } from './domain'

const domain = new Domain('http://localhost:4566/000000000000/my-queue')
const consumers = getConsumersFromInstance(domain) // <-- Get the consumers from the instance.
const looper = consumers.map((consumer) => new Looper(consumer)) // <-- Create a looper for each consumer

looper.forEach((looper) => looper.start()) // <-- Start the loopers. Each looper will call the consumer in a while(true) loop
```

Check the [acceptance test](./tests/pubsub.sqs.acceptance.ts) for a practical example. The test you teach you a lot about
how to use the framework.

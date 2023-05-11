# Dxqueue

## Developer Experienced Focused Queue Framework

A minimalistic nodejs queue framework built with developer experience in mind.
Dxqueue helps to create pubsub consumer workers while not splitting your codebase into two.
This lets you define infrastructure boundaries to meet your scaling requirements,
while not forcing you to accomodate your logical boundaries to your infrastructure.
If the consumer code and producer code are within the same bounded context, keeping them together is the best idea.

Check [this video](https://www.youtube.com/watch?v=BFcxgcoO5Ns) from CodeOpinion to understand the differences
between physical and logical boundaries.

## Installation

### Framework

```bash
npm install dxqueue
```

### Backend

Install your backend of choice. Currently only SQS is supported.

```bash
npm install @aws-sdk/client-sqs
```

## Usage

```typescript
// file: domain.ts

import { Queue } from '@santunioni/dxqueue'

export class Domain {
  constructor(private readonly queueUrl: string) {}

  // Generics <Domain, 'doSomething'> are optional, but help a lot with type inference.
  @Queue<Domain, 'doSomething'>((self) => ({
    // <-- You have access to the instance in the decorator factory
    backend: {
      type: 'sqs',
      config: {
        // <-- Read from env vars or use instance attributes. DXQueue don't constrain your design.
        endpoint: 'http://localhost:4566',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
      },
      url: self.queueUrl, // <-- Can use instance attributes. This allows dependency injection into the decorator
      waitTimeSeconds: 0,
    },
    logger: winston.getRootLogger(), // <-- Use the logger of your choice here. Defaults to console.
    message: {
      getGroupId: (my, arg) => my, // <-- Use the arguments to generate a group id. This allows you to group messages for FIFO queues. Type inference will known "my" is string and "arg" is number
    },
  }))
  async doSomething(my: string, arg: number) {
    // doing some heavy work that gets delayed by the Queue ...
  }
}
```

```typescript
// file: client.ts

import { Domain } from './domain'

const domain = new Domain('http://localhost:4566/000000000000/my-queue')
await domain.doSomething('my', 1) // <-- This will publish to the Queue instead of calling the method directly
```

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

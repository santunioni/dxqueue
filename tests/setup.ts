import { SQS } from "@aws-sdk/client-sqs";
import { beforeEach, afterEach, jest } from "@jest/globals";
import { wrapFunctionInPubSub } from "../src";
import { Logger } from "../src/config";

export function randomNumber() {
  return Number(
    `${Date.now() % 10 ** 4}${Math.floor(Math.random() * 10 ** 4)}`
  );
}

let standardQueueUrl: string;
let fifoQueueUrl: string;
let sqs: SQS;
let logger: Logger;

export function getQueueStandardUrl() {
  return standardQueueUrl;
}

export function getQueueFifoUrl() {
  return fifoQueueUrl;
}

export function getSqsClient() {
  return sqs;
}

export function getMockLogger() {
  return logger;
}

beforeEach(async () => {
  const queueName = `test-queue-${randomNumber()}`;

  logger = new Proxy({} as Logger, {
    get: (target, prop) => {
      let mock = target[prop];
      if (!mock) {
        mock = jest.fn();
        target[prop] = mock;
      }
      return mock;
    },
  });

  sqs = new SQS({
    endpoint: "http://localhost:4566",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  });

  standardQueueUrl = await sqs
    .createQueue({
      QueueName: queueName,
    })
    .then((res) => res.QueueUrl!);

  fifoQueueUrl = await sqs
    .createQueue({
      QueueName: `${queueName}.fifo`,
      Attributes: {
        FifoQueue: "true",
      },
    })
    .then((res) => res.QueueUrl!);
});

afterEach(async () => {
  await sqs.deleteQueue({
    QueueUrl: standardQueueUrl,
  });
  await sqs.deleteQueue({
    QueueUrl: fifoQueueUrl,
  });
});

export function createPubSubTestObjects(queueUrl: string) {
  const sqs = getSqsClient();
  const receiveMessageSpy = jest.spyOn(sqs, "receiveMessage");

  type FType = (params: { message: string; userId: number }) => void;
  const performIntensiveWork = jest.fn<FType>(async ({ message }) => {
    if (message.includes("error")) {
      throw new Error("Unexpected error");
    }
  });

  const { publisher, subscriber } = wrapFunctionInPubSub<Parameters<FType>>(
    performIntensiveWork,
    {
      backend: {
        queueUrl,
        client: sqs,
        waitTimeSeconds: 1,
      },
      message: {
        getGroupId: (param) => param[0].userId.toString(),
        getDeduplicationId: () => randomNumber().toString(), // Prevent deduplication
      },
      getLogger: getMockLogger,
    }
  );

  const abortController = new AbortController();

  return {
    performIntensiveWork,
    publisher,
    subscriber,
    abortController,
    receiveMessageSpy,
  };
}

export const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

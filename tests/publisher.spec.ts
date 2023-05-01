import { wrapFunctionInPubSub } from "../src";
import { getQueueStandardUrl, getSqsClient } from "./setup";

describe("publisher", () => {
  it("should publish message instead of calling function", async () => {
    const performIntensiveWork: (param: "param") => void = jest.fn();
    const { publisher } = wrapFunctionInPubSub(performIntensiveWork, {
      backend: {
        queueUrl: getQueueStandardUrl(),
        client: getSqsClient(),
      },
    });
    await publisher("param");

    expect(performIntensiveWork).not.toHaveBeenCalled();
  });

  it("should publish message as JSON", async () => {
    const { publisher } = wrapFunctionInPubSub<["param"]>(jest.fn(), {
      backend: {
        queueUrl: getQueueStandardUrl(),
        client: getSqsClient(),
      },
    });
    await publisher("param");

    const message = await getSqsClient().receiveMessage({
      QueueUrl: getQueueStandardUrl(),
    });
    expect(message.Messages!).toHaveLength(1);
  });
});

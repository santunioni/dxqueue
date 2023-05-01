import { wrapFunctionInPubSub } from "../src";
import { getQueueStandardUrl, getSqsClient } from "./setup";

describe("parsers", () => {
  describe("when function has multiple arguments", () => {
    it("should call sqs.publishMessage with encoded message", async () => {
      // Given: setup publisher and subscriber. AbortController is used to stop subscriber loop after message is processed.
      const abortController = new AbortController();
      const performIntensiveWork: (
        param1: number,
        param2: {
          c: number;
          d: string;
        }
      ) => void = jest.fn(() => {
        abortController.abort();
      });
      const { publisher, subscriber } = wrapFunctionInPubSub(
        performIntensiveWork,
        {
          backend: {
            queueUrl: getQueueStandardUrl(),
            client: getSqsClient(),
          },
        }
      );

      // When: publisher is called with multiple arguments
      await publisher(1, {
        c: 2,
        d: "3",
      });

      // Then: subscriber should call function with multiple arguments
      await subscriber.startLoop(abortController.signal);
      expect(performIntensiveWork).toHaveBeenCalledWith(1, {
        c: 2,
        d: "3",
      });
    });
  });

  describe("when function has one array argument", () => {
    it("should call sqs.publishMessage with encoded message", async () => {
      // Given: setup publisher and subscriber. AbortController is used to stop subscriber loop after message is processed.
      const abortController = new AbortController();
      const performIntensiveWork: (param: number[]) => void = jest.fn(() => {
        abortController.abort();
      });
      const { publisher, subscriber } = wrapFunctionInPubSub(
        performIntensiveWork,
        {
          backend: {
            queueUrl: getQueueStandardUrl(),
            client: getSqsClient(),
          },
        }
      );

      // When: publisher is called with array argument
      await publisher([1, 2, 3]);

      // Then: subscriber should call function with array argument
      await subscriber.startLoop(abortController.signal);
      expect(performIntensiveWork).toHaveBeenCalledWith([1, 2, 3]);
    });
  });
});

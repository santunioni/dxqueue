import "./setup";
import { createPubSubTestObjects, getQueueStandardUrl, sleep } from "./setup";

describe("subscriber", () => {
  describe("when the message queue is empty", () => {
    it("should keep polling until it is stopped externally", async () => {
      // Given subscriber doesn't receive any message
      const {
        abortController,
        performIntensiveWork,
        subscriber,
        receiveMessageSpy,
      } = createPubSubTestObjects(getQueueStandardUrl());

      // When: subscriber start looping
      const loop = subscriber.startLoop(abortController.signal);
      sleep(3).then(() => abortController.abort());

      // Then: subscriber stop polling only after it is stopped
      expect(await loop).toEqual({ wasStopped: true });
      expect(performIntensiveWork).toHaveBeenCalledTimes(0);
      expect(receiveMessageSpy.mock.calls.length).toBeGreaterThan(1);
    });
  });
});

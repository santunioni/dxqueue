import {
  createPubSubTestObjects,
  getMockLogger,
  getQueueFifoUrl,
  sleep,
} from "./setup";
import Mock = jest.Mock;

jest.setTimeout(10 * 1000);
describe("subscriber.fifo", () => {
  it("should not process consecutive messages of same group if the first message fails", async () => {
    // Given: the messages are never duplicated and the userId is used as groupId
    const { subscriber, publisher, abortController, performIntensiveWork } =
      createPubSubTestObjects(getQueueFifoUrl());
    const errorLogger = getMockLogger().error as Mock;

    // When: the first message for group userId=1 fails
    await publisher({ message: "error0", userId: 1 });
    for (let i = 0; i < 3; i++) {
      await publisher({ message: `message${i}`, userId: 1 });
      await publisher({ message: `message${i}`, userId: 2 });
    }
    const loop = subscriber.startLoop(abortController.signal);
    sleep(5).then(() => abortController.abort());
    await loop;

    // Then: subscriber should process the first message for group userId=1 and skip the rest
    const calls = performIntensiveWork.mock.calls;
    expect(calls.filter((p) => p[0].userId === 1)).toHaveLength(1);
    expect(calls.filter((p) => p[0].userId === 2)).toHaveLength(3);
    expect(errorLogger).toHaveBeenCalledTimes(1);
    expect(errorLogger.mock.calls[0][1]).toMatchObject({
      groupId: "1",
    });
  });
});

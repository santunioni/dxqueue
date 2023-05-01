import { Fn, ConfigOrFactory } from "./config";
import { createPublisher } from "./publisher";
import { Subscriber } from "./subscriber";

export function wrapFunctionInPubSub<P extends any[]>(
  func: Fn<P>,
  optOrFactory: ConfigOrFactory<P>
) {
  return {
    publisher: createPublisher(optOrFactory),
    subscriber: new Subscriber(func, optOrFactory),
  };
}

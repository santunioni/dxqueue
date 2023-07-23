import { Config, Fn } from './initialization/config'
import { createConsumer, createProducer } from './initialization/factories'

/**
 * Wrap a function in a queue. The returned object contains a wrapped function and a consumer.
 * The wrapped function can be used to publish messages to the queue.
 * The consumer can be used to consume messages from the queue, calling the original function.
 * @param func the function to wrap
 * @param config the configuration for the queue
 */
export function wrapFunctionInQueue<P extends any[]>(
  func: Fn<P>,
  config: Config<P>,
) {
  const producer = createProducer(func, config)
  const consumer = createConsumer(func, config)
  return {
    wrapped: (...args: P) => producer.publish(...args),
    consumer,
  }
}

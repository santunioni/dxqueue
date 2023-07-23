import { Config, Fn } from './initialization/config'
import { createConsumer, createProducer } from './initialization/factories'
import { Consumer } from './interfaces'

/**
 * A WeakMap that returns a default value when the key is not found.
 */
class DefaultWeakMap<K extends Object, V> extends WeakMap<K, V> {
  constructor(private readonly defaultFactory: () => V) {
    super()
  }

  get(key: K): V {
    if (!this.has(key)) {
      this.set(key, this.defaultFactory())
    }
    return super.get(key)!
  }
}

/**
 * Wrap a single-argument function in a memoization layer.
 * @param func
 */
function memoizeeSingleArgument<I, R>(func: (i: I) => R) {
  const cache = new Map<I, R>()
  return function (i: I) {
    let result = cache.get(i)
    if (!result) {
      result = func(i)
      cache.set(i, result)
    }
    return result
  }
}

type ConfigFactory<T extends Object, P extends unknown[]> = (
  instance: T,
) => Config<P>

type QueueDecoratorParams<
  T extends Object,
  K extends keyof T & string,
> = Parameters<T[K] extends Fn<any[]> ? T[K] : never>

const ORIGINAL_CLASS_DESCRIPTORS = new DefaultWeakMap<
  Object,
  Map<
    string,
    {
      value: any
      configFactory: ConfigFactory<any, any>
    }
  >
>(() => new Map())

/**
 * Replaces the decorated method with a publisher. The original method is passed to consumers
 * instantiated with getConsumerFromInstanceMethod or getConsumersFromInstance.
 * @param configFactory
 */
export function Queue<
  T extends Object,
  K extends keyof T & string = keyof T & string,
>(configFactory: ConfigFactory<T, QueueDecoratorParams<T, K>>) {
  return function (clsPrototype: T, methodName: K, descriptor) {
    const cachedConfigFactory = memoizeeSingleArgument(configFactory)

    ORIGINAL_CLASS_DESCRIPTORS.get(clsPrototype).set(methodName, {
      value: descriptor.value,
      configFactory: cachedConfigFactory,
    })

    return {
      get() {
        const config = cachedConfigFactory(this as unknown as T)
        const producer = createProducer(descriptor.value.bind(this), config)
        const publisher = (...args: any) => producer.publish(...args)

        Object.defineProperty(this, methodName, {
          value: publisher,
          enumerable: false,
          configurable: false,
          writable: false,
        })

        return publisher
      },
    }
  }
}

const METHOD_CONSUMERS_BY_INSTANCE = new DefaultWeakMap<
  any,
  Map<string, Consumer>
>(() => new Map())

/**
 * Returns a consumer for a method decorated with @Queue() on the given instance.
 * @param instance
 * @param method
 */
export function getConsumerFromInstanceMethod<
  T extends object,
  M extends keyof T & string = keyof T & string,
>(instance: T, method: M): Consumer {
  let consumer = METHOD_CONSUMERS_BY_INSTANCE.get(instance).get(method)

  if (!consumer) {
    const descriptor = ORIGINAL_CLASS_DESCRIPTORS.get(
      instance.constructor.prototype,
    ).get(method)

    if (!descriptor) {
      throw new Error(`No subscriber found for method ${method}`)
    }

    consumer = createConsumer(
      descriptor.value.bind(instance),
      descriptor.configFactory(instance),
    )

    METHOD_CONSUMERS_BY_INSTANCE.get(instance).set(method, consumer)
  }

  return consumer
}

/**
 * Returns an array of consumers for all methods decorated with @Queue() on the given instance.
 * @param instance
 */
export function getConsumersFromInstance(instance: any): Consumer[] {
  return Array.from(
    ORIGINAL_CLASS_DESCRIPTORS.get(instance.constructor.prototype).keys(),
  ).map((method) => getConsumerFromInstanceMethod(instance, method))
}

import { Config, Fn } from './initialization/config'
import { createConsumer, createProducer } from './initialization/factories'
import { Consumer } from './interfaces'

/**
 * A WeakMap that returns a default value when the key is not found.
 */
class DefaultWeakMap<K extends object, V> extends WeakMap<K, V> {
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
function memoizeeSingleArgument<I, R>(
  func: (instance: I) => R,
): (intance: I) => R {
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

type ConfigFactory<T extends object, P extends unknown[]> = (
  instance: T,
) => Config<P>

type DecoratedClassMethod<
  DecoratedClass extends object,
  DecoratedMethodKey extends keyof DecoratedClass & string,
> = DecoratedClass[DecoratedMethodKey] extends Fn<any[]>
  ? DecoratedClass[DecoratedMethodKey]
  : never

type QueueDecoratorParams<
  DecoratedClass extends object,
  DecoratedMethodKey extends keyof DecoratedClass & string,
> = Parameters<DecoratedClassMethod<DecoratedClass, DecoratedMethodKey>>

const ORIGINAL_CLASS_DESCRIPTORS = new DefaultWeakMap<
  object,
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
  DecoratedClass extends object,
  DecoratedMethodKey extends keyof DecoratedClass &
    string = keyof DecoratedClass & string,
>(
  configFactory: ConfigFactory<
    DecoratedClass,
    QueueDecoratorParams<DecoratedClass, DecoratedMethodKey>
  >,
) {
  return function (
    clsPrototype: DecoratedClass,
    methodName: DecoratedMethodKey,
    descriptor,
  ) {
    const cachedConfigFactory = memoizeeSingleArgument(configFactory)

    ORIGINAL_CLASS_DESCRIPTORS.get(clsPrototype).set(methodName, {
      value: descriptor.value,
      configFactory: cachedConfigFactory,
    })

    return {
      get() {
        const config = cachedConfigFactory(this as unknown as DecoratedClass)
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
  ConsumerInstanceType extends object,
  ConsumerInstanceMethod extends keyof ConsumerInstanceType &
    string = keyof ConsumerInstanceType & string,
>(instance: ConsumerInstanceType, method: ConsumerInstanceMethod): Consumer {
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

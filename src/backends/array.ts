import { Consumer, Publisher } from '../interfaces'
import { Fn, MessageConfig } from '../initialization/config'

export type ArrayBackendConfig<P extends unknown[]> = {
  type: 'array'
  queue: string[]
}

/**
 * This consumer is used for testing purposes only.
 * Don't use in production.
 */
export class ArrayPollerConsumer<P extends unknown[]> implements Consumer {
  constructor(
    private readonly processPayload: Fn<P>,
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: ArrayBackendConfig<P>,
  ) {}

  async consume() {
    let messagesConsumed = 0
    while (this.backendConfig.queue.length > 0) {
      const msg = this.backendConfig.queue.shift()
      if (msg) {
        await this.processPayload(...this.messageConfig.decode(msg))
        messagesConsumed++
      }
    }
    return messagesConsumed
  }
}

/**
 * This consumer is used for testing purposes only.
 * Don't use in production.
 */
export class ArrayPusherProducer<P extends unknown[]> implements Publisher<P> {
  constructor(
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: ArrayBackendConfig<P>,
  ) {}

  async publish(...params: P) {
    this.backendConfig.queue.push(this.messageConfig.encode(params))
  }
}

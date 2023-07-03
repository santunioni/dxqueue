import { Consumer, Publisher } from '../interfaces'
import { Fn, MessageConfig } from '../initialization/config'

export type MockBackendConfig<P extends any[]> = {
  type: 'mock'
  queue: string[]
}

export class MockConsumer<P extends any[]> implements Consumer {
  constructor(
    private readonly processPayload: Fn<P>,
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: MockBackendConfig<P>,
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

export class MockProducer<P extends any[]> implements Publisher<P> {
  constructor(
    private readonly messageConfig: MessageConfig<P>,
    private readonly backendConfig: MockBackendConfig<P>,
  ) {}

  async publish(...params: P) {
    this.backendConfig.queue.push(this.messageConfig.encode(params))
  }
}

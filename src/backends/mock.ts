import { Consumer, Publisher } from '../interfaces'

export type MockBackendConfig<P extends any[]> = {
  type: 'mock'
  queue: string[]
}

export class MockConsumer implements Consumer {
  constructor(
    private readonly queue: string[],
    private readonly processPayload: (payload: string) => Promise<void>,
  ) {}

  async consume() {
    while (this.queue.length > 0) {
      const msg = this.queue.shift()
      if (msg) {
        await this.processPayload(msg)
      }
    }
  }
}

export class MockProducer<P extends any[]> implements Publisher<P> {
  constructor(
    private readonly queue: string[],
    private readonly encode: (params: P) => string,
  ) {}

  async publish(...params: P) {
    this.queue.push(this.encode(params))
  }
}

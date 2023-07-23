import { Fn, MessageConfig } from '../initialization/config'
import { Consumer, Publisher } from '../interfaces'

/**
 * This producer is used for testing purposes only.
 * Don't use in production.
 */
export class MockedPublisher<P extends any[]> implements Publisher<P> {
  constructor(
    private readonly processPayload: Fn<P>,
    private readonly messageConfig: MessageConfig<P>,
  ) {}

  async publish(...params: P) {
    await this.processPayload(
      ...this.messageConfig.decode(this.messageConfig.encode(params)),
    )
  }
}

export class MockedConsumer implements Consumer {
  async consume(): Promise<number> {
    throw new Error('Should not be called')
  }
}

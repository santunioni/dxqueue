import { Consumer } from '../interfaces'

export class Looper {
  constructor(private readonly consumer: Consumer) {}

  async start(signal: AbortSignal) {
    while (!signal.aborted) {
      await this.consumer.consume()
    }
  }
}

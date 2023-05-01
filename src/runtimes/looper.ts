import { Consumer } from '../interfaces'

export class Looper {
  constructor(private readonly consumer: Consumer) {}

  async startLoop(signal?: AbortSignal) {
    let shouldContinue = true
    signal?.addEventListener('abort', () => {
      shouldContinue = false
    })

    while (shouldContinue) {
      await this.consumer.consume()
    }

    return { wasStopped: !shouldContinue }
  }
}

import { Consumer } from '../interfaces'

export class Looper {
  constructor(private readonly consumer: Consumer) {}

  async start(
    signal: AbortSignal,
    shouldContinue: (lastNumberOfMessagesConsumed: number) => boolean = () =>
      true,
  ) {
    let shouldStop = false
    while (!shouldStop) {
      const lastNumberOfMessagesConsumed = await this.consumer.consume()
      shouldStop =
        signal.aborted || !shouldContinue(lastNumberOfMessagesConsumed)
    }
    return { wasStopped: shouldStop }
  }
}

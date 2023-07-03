import { Looper } from './looper'
import { Consumer } from '../interfaces'

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Looper', () => {
  it('should keep polling until it is stopped externally', async () => {
    const consumer: Consumer = {
      consume: () => sleep(1).then(() => 1),
    }
    const looper = new Looper(consumer)
    const abortController = new AbortController()

    // When: subscriber start looping
    const loop = looper.start(abortController.signal)
    sleep(10).then(() => abortController.abort())

    // Then: subscriber stop polling only after it is stopped
    expect(await loop).toEqual({ wasStopped: true })
  })
})

import { Config, Fn, parseConfig } from './config'
import { Consumer, Logger, Publisher } from '../interfaces'

function wrapReceiverFunction<P extends any[]>(
  func: Fn<P>,
  decoder: (b: string) => P,
  logger: Logger,
) {
  return async (payload: string) => {
    const ret = await func(...decoder(payload))
    if (ret !== undefined) {
      logger.warn(
        'The function wrapped in dxqueue is returning but it should not return anything.',
        {
          name: func.name,
        },
      )
    }
  }
}

export function createConsumer<P extends any[]>(
  func: Fn<P>,
  config: Config<P>,
): Consumer {
  const parsedConfig = parseConfig(config)
  const processPayload = wrapReceiverFunction(
    func,
    parsedConfig.decode,
    parsedConfig.logger,
  )

  if (config.backend.type === 'sqs') {
    const { SqsConsumer } = require('../backends/sqs')
    return new SqsConsumer(processPayload, parsedConfig.logger, config.backend)
  }

  if (config.backend.type === 'mock') {
    const { MockConsumer } = require('../backends/mock')
    return new MockConsumer(config.backend.queue, processPayload)
  }

  throw new Error('Invalid backend type')
}

export function createProducer<P extends any[]>(
  config: Config<P>,
): Publisher<P> {
  const parsedConfig = parseConfig(config)

  if (config.backend.type === 'sqs') {
    const { SqsProducer } = require('../backends/sqs')
    return new SqsProducer(
      parsedConfig.logger,
      parsedConfig.encode,
      parsedConfig.getGroupId,
      config.backend,
    )
  }

  if (config.backend.type === 'mock') {
    const { MockProducer } = require('../backends/mock')
    return new MockProducer(config.backend.queue, parsedConfig.encode)
  }

  throw new Error('Invalid backend type')
}

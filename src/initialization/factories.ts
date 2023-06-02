import { Config, Fn, parseMessageConfig } from './config'
import { Consumer, Publisher } from '../interfaces'

export function createConsumer<P extends any[]>(
  func: Fn<P>,
  config: Config<P>,
): Consumer {
  const messageConfig = parseMessageConfig(config.message ?? {})

  if (config.backend.type === 'sqs') {
    const { SqsConsumer } = require('../backends/sqs')
    return new SqsConsumer(func, messageConfig, config.backend)
  }

  if (config.backend.type === 'mock') {
    const { MockConsumer } = require('../backends/mock')
    return new MockConsumer(func, messageConfig, config.backend)
  }

  throw new Error('Invalid backend type')
}

export function createProducer<P extends any[]>(
  config: Config<P>,
): Publisher<P> {
  const messageConfig = parseMessageConfig(config.message ?? {})

  if (config.backend.type === 'sqs') {
    const { SqsProducer } = require('../backends/sqs')
    return new SqsProducer(messageConfig, config.backend)
  }

  if (config.backend.type === 'mock') {
    const { MockProducer } = require('../backends/mock')
    return new MockProducer(messageConfig, config.backend)
  }

  throw new Error('Invalid backend type')
}

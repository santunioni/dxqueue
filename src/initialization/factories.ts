import { Config, Fn, parseMessageConfig } from './config'
import { Consumer, Publisher } from '../interfaces'
import * as process from 'process'
import { MockedConsumer, MockedPublisher } from '../backends/mock'
import { ArrayPollerConsumer, ArrayPusherProducer } from '../backends/array'
import { ConfigurationError } from './exception'

function shouldBypassQueueBackendBecauseConfiguredEnvironmentVariable() {
  return (
    process.env.DXQUEUE_BYPASS_QUEUE_BACKEND &&
    process.env.DXQUEUE_BYPASS_QUEUE_BACKEND !== 'false' &&
    process.env.DXQUEUE_BYPASS_QUEUE_BACKEND !== '0'
  )
}

export function createConsumer<P extends unknown[]>(
  func: Fn<P>,
  config: Config<P>,
): Consumer {
  const messageConfig = parseMessageConfig(config.message ?? {})

  if (shouldBypassQueueBackendBecauseConfiguredEnvironmentVariable()) {
    return new MockedConsumer()
  }

  if (config.backend.type === 'sqs') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SqsConsumer } = require('../backends/sqs')
    return new SqsConsumer(func, messageConfig, config.backend)
  }

  if (config.backend.type === 'array') {
    return new ArrayPollerConsumer(func, messageConfig, config.backend)
  }

  throw new ConfigurationError('Invalid backend type')
}

export function createProducer<P extends unknown[]>(
  func: Fn<P>,
  config: Config<P>,
): Publisher<P> {
  const messageConfig = parseMessageConfig(config.message ?? {})

  if (shouldBypassQueueBackendBecauseConfiguredEnvironmentVariable()) {
    return new MockedPublisher(func, messageConfig)
  }

  if (config.backend.type === 'sqs') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SqsProducer } = require('../backends/sqs')
    return new SqsProducer(messageConfig, config.backend)
  }

  if (config.backend.type === 'array') {
    return new ArrayPusherProducer(messageConfig, config.backend)
  }

  throw new ConfigurationError('Invalid backend type')
}

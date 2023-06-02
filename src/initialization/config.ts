import { ConsoleLogger, defaultDecode, defaultEncode } from './defaults'
import { Logger } from '../interfaces'
import { MockBackendConfig } from '../backends/mock'
import { SQSBackendConfig } from '../backends/sqs.config'

export type Config<P extends any[]> = {
  message?: {
    /**
     * Defaults to JSON.parse. The function should throw an error if the body is invalid JSON.
     * @param body
     */
    decode?: (body: string) => P
    /**
     * Defaults to JSON.stringify.
     * @param params
     */
    encode?: (params: P) => string
  }
  backend: SQSBackendConfig<P> | MockBackendConfig<P>
  /**
   * The logger to use, defaulting to console.
   * You can use a custom logger by passing a function that returns a logger.
   * @example winston.createLogger(...)
   * @external Logger
   */
  logger?: Logger
}

export type Fn<P extends any[]> = (...params: P) => void | Promise<void>

export function parseConfig<P extends any[]>(config: Config<P>) {
  const logger: Logger = config.logger ?? new ConsoleLogger()

  const decode: (b: string) => P = config.message?.decode ?? defaultDecode
  const encode: (params: P) => string = config.message?.encode ?? defaultEncode

  return {
    decode,
    encode,
    logger,
  }
}

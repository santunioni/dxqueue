import { ArrayBackendConfig } from '../backends/array'
import { SQSBackendConfig } from '../backends/sqs.config'

export type MessageConfig<P extends unknown[]> = {
  /**
   * Defaults to JSON.parse. The function should throw an error if the body is invalid JSON.
   * @param body
   */
  decode: (body: string) => P
  /**
   * Defaults to JSON.stringify.
   * @param params
   */
  encode: (params: P) => string
}

export type Config<P extends unknown[]> = {
  message?: MessageConfig<P>
  backend: SQSBackendConfig<P> | ArrayBackendConfig<P>
}

export type Fn<P extends unknown[]> = (...params: P) => void | Promise<void>

export function parseMessageConfig<P extends unknown[]>(
  messageConfig: Partial<MessageConfig<P>>,
): MessageConfig<P> {
  const decode: (b: string) => P = messageConfig?.decode ?? JSON.parse
  const encode: (params: P) => string = messageConfig?.encode ?? JSON.stringify

  return {
    decode,
    encode,
  }
}

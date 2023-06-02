import { defaultDecode, defaultEncode } from './defaults'
import { MockBackendConfig } from '../backends/mock'
import { SQSBackendConfig } from '../backends/sqs.config'

export type MessageConfig<P extends any[]> = {
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

export type Config<P extends any[]> = {
  message?: MessageConfig<P>
  backend: SQSBackendConfig<P> | MockBackendConfig<P>
}

export type Fn<P extends any[]> = (...params: P) => void | Promise<void>

export function parseMessageConfig<P extends any[]>(
  messageConfig: Partial<MessageConfig<P>>,
): MessageConfig<P> {
  const decode: (b: string) => P = messageConfig?.decode ?? defaultDecode
  const encode: (params: P) => string = messageConfig?.encode ?? defaultEncode

  return {
    decode,
    encode,
  }
}

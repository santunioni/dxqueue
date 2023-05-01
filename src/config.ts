import { SQS } from "@aws-sdk/client-sqs";
import type {
  SQSClientConfig,
  ReceiveMessageCommandInput,
  SendMessageCommandInput,
} from "@aws-sdk/client-sqs";
import { hashCode } from "./hash";

export type Logger = {
  debug: (...content: any[]) => void;
  info: (...content: any[]) => void;
  warn: (...content: any[]) => void;
  error: (...content: any[]) => void;
};

type Options<P> = {
  message?: {
    parse?: (body: string) => P;
    encode?: (params: P) => string;
    /**
     * Used for FIFO queues, ignored for standard. The group id is used for ordering messages within a 5-minute period.
     * @param params the same params passed to the function wrapped in pubsub.
     * @external SendMessageCommandInput#MessageGroupId
     */
    getGroupId?: (params: P) => string;
    /**
     * Used for FIFO queues, ignored for standard. The deduplication id is used for deduplication of messages within a 5-minute period.
     * Defaults to hashing the params.
     * @param params the same params passed to the function wrapped in pubsub.
     * @external SendMessageCommandInput#MessageDeduplicationId
     */
    getDeduplicationId?: (params: P) => string;
  };
  backend: {
    /**
     * The URL of the Amazon SQS queue to take action on.
     * @external ReceiveMessageCommandInput#QueueUrl
     */
    queueUrl: string;
    /**
     * The Amazon SQS client to use. Takes precendence over clientConfig.
     */
    client?: SQS;
    /**
     * The Amazon SQS client configuration to use.
     * @external #SQSClientConfig
     */
    clientConfig?: SQSClientConfig;
    /**
     * The time in seconds for which the call waits for a message to arrive in the queue before returning.
     * @external ReceiveMessageCommandInput#WaitTimeSeconds
     */
    waitTimeSeconds?: number;
  };
  getLogger?: () => Logger;
};

export type Fn<P extends any[]> = (...params: P) => void | Promise<void>;
export type TFn<P extends any[]> = (...params: P) => Promise<void>;
export type ConfigOrFactory<P> = Options<P> | (() => Options<P>);

function parseNewConfig<P extends any[]>(optOrFactory: ConfigOrFactory<P>) {
  const options =
    typeof optOrFactory === "function" ? optOrFactory() : optOrFactory;

  const logger: Logger = options.getLogger?.() ?? {
    debug: console.debug,
    error: console.error,
    info: console.info,
    warn: console.warn,
  };

  const sqs =
    options.backend.client ??
    (options.backend.clientConfig
      ? new SQS(options.backend.clientConfig)
      : new SQS({}));

  const parse: (b: string) => P = options.message?.parse ?? JSON.parse;
  const encode: (params: P) => string =
    options.message?.encode ?? JSON.stringify;

  const isFifo = options.backend.queueUrl.endsWith(".fifo");
  const getDeduplicationId =
    options.message?.getDeduplicationId ??
    ((params: P) => hashCode(encode(params)).toString(16));
  const getGroupId = options.message?.getGroupId ?? (() => "1");

  if (isFifo && !options.message?.getDeduplicationId) {
    logger.warn(
      "You should define message.getDeduplicationId for fifo queues. Defaulting to content based deduplication (hashing the params)."
    );
  }

  if (isFifo && !options.message?.getGroupId) {
    logger.warn(
      "You should define message.getGroupId for fifo queues to guarantee ordering for messages within the same group. Defaulting to ordering all messages, which is low performance."
    );
  }

  return {
    parse,
    encode,
    isFifo,
    sqs,
    logger,
    options,
    getDeduplicationId,
    getGroupId,
  };
}

export type ParsedConfig<P extends any[]> = ReturnType<
  typeof parseNewConfig<P>
>;

const inputResultCache = new WeakMap<ConfigOrFactory<any>, ParsedConfig<any>>();

export function parseConfig<P extends any[]>(
  cfgOrFactory: ConfigOrFactory<P>
): ParsedConfig<P> {
  let result = inputResultCache.get(cfgOrFactory);
  if (!result) {
    result = parseNewConfig(cfgOrFactory);
    inputResultCache.set(cfgOrFactory, result as ParsedConfig<any>);
  }
  return result as ParsedConfig<P>;
}

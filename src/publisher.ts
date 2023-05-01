import { ConfigOrFactory, parseConfig, TFn } from "./config";
import { SendMessageCommandInput } from "@aws-sdk/client-sqs/dist-types/commands/SendMessageCommand";

export function createPublisher<P extends any[]>(
  cfgOrFactory: ConfigOrFactory<P>
) {
  const client: TFn<P> = async (...params: P) => {
    const { sqs, options, encode, isFifo, getDeduplicationId, getGroupId } =
      parseConfig(cfgOrFactory);

    await sqs.sendMessage({
      MessageBody: encode(params),
      QueueUrl: options.backend.queueUrl,
      ...(isFifo
        ? ({
            MessageDeduplicationId: getDeduplicationId(params),
            MessageGroupId: getGroupId(params),
          } as SendMessageCommandInput)
        : {}),
    });
  };
  return client;
}

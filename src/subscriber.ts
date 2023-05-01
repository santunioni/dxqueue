import { Fn, ConfigOrFactory, parseConfig } from "./config";
import { Message, ReceiveMessageCommandInput } from "@aws-sdk/client-sqs";

export class Subscriber<P extends any[]> {
  constructor(
    private readonly func: Fn<P>,
    private readonly cfgOrFactory: ConfigOrFactory<P>
  ) {}

  private get config() {
    return parseConfig(this.cfgOrFactory);
  }

  async startLoop(signal?: AbortSignal) {
    const { sqs, isFifo, options } = this.config;

    let shouldContinue = true;
    signal?.addEventListener("abort", () => {
      shouldContinue = false;
    });

    while (shouldContinue) {
      const { Messages } = await sqs.receiveMessage({
        QueueUrl: options.backend.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: options.backend.waitTimeSeconds ?? 5,
        ...(isFifo
          ? ({
              AttributeNames: ["MessageGroupId"],
            } as ReceiveMessageCommandInput)
          : {}),
      });

      if (!Messages) continue;

      if (isFifo) {
        await this.processMessagesFifo(Messages);
      } else {
        await this.processMessagesStandard(Messages);
      }
    }

    const wasStopped = !shouldContinue;
    return { wasStopped };
  }

  private async processMessagesStandard(Messages: Message[]) {
    const { logger, options } = this.config;
    await Promise.all(
      Messages.map((message) =>
        this.proccessSingleMessage(message).catch((error) => {
          logger.error("Error processing message", {
            error,
            message,
            name: this.func.name,
            queueUrl: options.backend.queueUrl,
          });
        })
      )
    );
  }

  private async processMessagesFifo(Messages: Message[]) {
    const { logger, options } = this.config;
    const failedGroupIds = new Set<string>();

    for (const message of Messages) {
      const groupId: string = message.Attributes?.MessageGroupId!;
      try {
        if (failedGroupIds.has(groupId)) {
          logger.warn("Skipping message because the group id failed before", {
            groupId,
            name: this.func.name,
            queueUrl: options.backend.queueUrl,
          });
          continue;
        }
        await this.proccessSingleMessage(message);
      } catch (error) {
        failedGroupIds.add(groupId);
        logger.error("Error processing message", {
          error,
          message,
          groupId,
          name: this.func.name,
          queueUrl: options.backend.queueUrl,
        });
      }
    }
  }

  private async proccessSingleMessage(message: Message) {
    const { parse, logger, sqs, options } = this.config;
    const body: P = parse(message.Body!);

    const ret = await this.func(...body);

    if (ret !== undefined) {
      logger.warn(
        "The function wrapped in dxqueue is returning but it should not return anything.",
        {
          name: this.func.name,
          queueUrl: options.backend.queueUrl,
        }
      );
    }

    await sqs.deleteMessage({
      QueueUrl: options.backend.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });
  }
}

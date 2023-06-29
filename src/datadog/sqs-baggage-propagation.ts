import tracer from 'dd-trace'
import { Message } from '@aws-sdk/client-sqs'
import SpanContext from 'opentracing/lib/span_context'

type DataDogWrapper = <T>(message: Message, fn: () => T) => T

export function createDatadogTracerSqsMessageProcessorWrapper(
  name: string,
): DataDogWrapper {
  return (message, fn) =>
    consumeSqsMessageWithDatadogTracingActivated(name, message, fn)
}

export function consumeSqsMessageWithDatadogTracingActivated<T>(
  name: string,
  message: Message,
  fn: () => T,
): T {
  return tracer.trace(
    name,
    {
      childOf: extractParentContextFromSqsMessage(message),
    },
    fn,
  )
}

export function extractParentContextFromSqsMessage(
  message: Pick<Message, 'MessageAttributes' | 'Body'>,
): SpanContext | undefined {
  return (
    extractParentContextFromMessageAttributes(message) ??
    extractParentContextFromMessageSentBySNSWithRawMessageDeliveryDisabled(
      message,
    )
  )
}

function extractParentContextFromMessageAttributes(
  message: Pick<Message, 'MessageAttributes'>,
): SpanContext | undefined {
  if (
    message.MessageAttributes?._datadog &&
    message.MessageAttributes._datadog.DataType === 'String' &&
    message.MessageAttributes._datadog.StringValue
  ) {
    const parentSpanContext = tracer.extract(
      'http_headers',
      JSON.parse(message.MessageAttributes._datadog.StringValue),
    )
    if (parentSpanContext) {
      return parentSpanContext
    }
  }

  if (
    message.MessageAttributes?._datadog &&
    message.MessageAttributes._datadog.DataType === 'Binary' &&
    message.MessageAttributes._datadog.BinaryValue
  ) {
    const baggage = JSON.parse(
      message.MessageAttributes._datadog.BinaryValue.toString(),
    )
    console.log({ baggage })
    const parentSpanContext = tracer.extract('text_map', baggage)
    if (parentSpanContext) {
      return parentSpanContext
    }
  }

  return undefined
}

function extractParentContextFromMessageSentBySNSWithRawMessageDeliveryDisabled(
  message: Pick<Message, 'Body'>,
): SpanContext | undefined {
  if (!message.Body) {
    return undefined
  }

  const messageBody: SNSMessageWithRawContentDeliveryDisabled = JSON.parse(
    message.Body,
  )

  if (
    messageBody.Type !== 'Notification' ||
    !messageBody.TopicArn ||
    !messageBody.MessageAttributes
  ) {
    return undefined
  }

  if (
    messageBody.MessageAttributes._datadog &&
    messageBody.MessageAttributes._datadog.Type === 'String' &&
    messageBody.MessageAttributes._datadog.Value
  ) {
    const parentSpanContext = tracer.extract(
      'http_headers',
      JSON.parse(messageBody.MessageAttributes._datadog.Value),
    )
    if (parentSpanContext) {
      return parentSpanContext
    }
  }

  if (
    messageBody.MessageAttributes._datadog &&
    messageBody.MessageAttributes._datadog.Type === 'Binary' &&
    messageBody.MessageAttributes._datadog.Value
  ) {
    const baggage = JSON.parse(
      Buffer.from(
        messageBody.MessageAttributes._datadog.Value,
        'base64',
      ).toString(),
    )
    console.log({ baggage })
    const parentSpanContext = tracer.extract('text_map', baggage)
    if (parentSpanContext) {
      return parentSpanContext
    }
  }

  return undefined
}

type SNSMessageWithRawContentDeliveryDisabled = {
  Type: 'Notification'
  TopicArn: string
  Message: string
  MessageAttributes: SNSMessageAttributesWithRawContentDeliveryDisabled
}

type SNSMessageAttributesWithRawContentDeliveryDisabled = Record<
  string,
  | {
      Type: 'String'
      Value: string
    }
  | {
      Type: 'Binary'
      Value: string
    }
>

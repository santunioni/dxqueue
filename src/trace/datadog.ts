import { MessageAttributeValue } from '@aws-sdk/client-sqs/dist-types/models/models_0'
import { SpanContext } from 'dd-trace'

const LazyTracer = () => require('dd-trace').default
type Tracer = ReturnType<typeof LazyTracer>
let tracer: Tracer | null
try {
  tracer = LazyTracer()
} catch (error) {
  tracer = null
}

export function wrapInTracer<F>(fn: F): F {
  if (tracer === null) {
    return fn
  }
  return tracer.wrap('sqs.publish', fn)
}

const X_DATADOG_TRACE_ID = 'x-datadog-trace-id'
const X_DATADOG_PARENT_ID = 'x-datadog-parent-id'
const X_DATADOG_SPAN_ID = 'x-datadog-span-id'

export function propagateTraceBaggage(
  messageAttributes?: Record<string, MessageAttributeValue>,
): Record<string, MessageAttributeValue> | undefined {
  if (tracer === null) {
    return messageAttributes
  }

  const span = tracer.scope().active()

  if (span === null) {
    return messageAttributes
  }

  const context = span.context()

  const traceId = context.toTraceId()
  const spanId = context.toSpanId()
  const parentId = context.toTraceparent()

  return Object.assign(messageAttributes ?? {}, {
    [X_DATADOG_TRACE_ID]: {
      DataType: 'String',
      StringValue: traceId,
    },
    [X_DATADOG_PARENT_ID]: {
      DataType: 'String',
      StringValue: parentId,
    },
    [X_DATADOG_SPAN_ID]: {
      DataType: 'String',
      StringValue: spanId,
    },
  } as Record<string, MessageAttributeValue>)
}

export function runInTraceContextPropagatedFromBaggageInMessageAttributes<
  F extends (...args: any[]) => any,
>(fn: F, messageAttributes?: Record<string, MessageAttributeValue>) {
  if (tracer === null) {
    return fn()
  }

  const traceId = messageAttributes?.[X_DATADOG_TRACE_ID].StringValue
  const spanId = messageAttributes?.[X_DATADOG_SPAN_ID].StringValue
  const parentId = messageAttributes?.[X_DATADOG_PARENT_ID].StringValue

  let childOf: SpanContext | undefined
  if (traceId && spanId && parentId) {
    childOf = {
      toSpanId: () => spanId,
      toTraceId: () => traceId,
      toTraceparent: () => parentId,
    }
  }

  const span = tracer.startSpan('sqs.consume', {
    childOf,
  })

  return tracer.scope().activate(span, () => fn())
}

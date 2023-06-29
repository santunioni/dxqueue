import { extractParentContextFromSqsMessage } from './sqs-baggage-propagation'
import tracer from 'dd-trace'

describe.skip('extractParentContext', () => {
  it('should extract trace from messages sent by sns with raw message delivery enabled', () => {
    const parentContext = extractParentContextFromSqsMessage({
      MessageAttributes: {
        _datadog: {
          DataType: 'Binary',
          BinaryValue: Buffer.from(
            'eyJ4LWRhdGFkb2ctdHJhY2UtaWQiOiIxMjk3NjE5MDk0NzMzMTMzOTY2MCIsIngtZGF0YWRvZy1wYXJlbnQtaWQiOiI1MDgzNjEwMTM5OTUxMjExNTU1IiwieC1kYXRhZG9nLXNhbXBsaW5nLXByaW9yaXR5IjoiMSIsIngtZGF0YWRvZy10YWdzIjoiX2RkLnAuZG09LTEiLCJ0cmFjZXBhcmVudCI6IjAwLTAwMDAwMDAwMDAwMDAwMDBiNDE0YjBlYTcxNTJmNThjLTQ2OGM5YzdjZjg1ZGE0MjMtMDEiLCJ0cmFjZXN0YXRlIjoiZGQ9dC5kbTotMTtzOjEifQ',
            'base64',
          ),
        },
      },
    })

    expect(parentContext).toBeDefined()
    expect(parentContext!.toTraceId()).toEqual('12976190947331339660') // Got this value from base64 decoding the Value in MessageAttributes
  })

  it('should extract trace from messages sent by sns with raw message delivery disabled', () => {
    const parentContext = extractParentContextFromSqsMessage({
      Body: JSON.stringify({
        Type: 'Notification',
        TopicArn: 'arn:aws:sns:eu-west-1:123456789012:my-topic',
        MessageAttributes: {
          _datadog: {
            Type: 'Binary',
            Value:
              'eyJ4LWRhdGFkb2ctdHJhY2UtaWQiOiIxMDMzMjg1NTkzMzM4MzU1MTY1IiwieC1kYXRhZG9nLXBhcmVudC1pZCI6IjM5MzQ2MzI0NzAwNzc4MTk2ODYiLCJ4LWRhdGFkb2ctc2FtcGxpbmctcHJpb3JpdHkiOiIyIiwidHJhY2VwYXJlbnQiOiIwMC0wMDAwMDAwMDAwMDAwMDAwMGU1NmY3YzVjNjc2MWRkZC0zNjlhOWY2MjhjYjRjYjI2LTAxIiwidHJhY2VzdGF0ZSI6ImRkPXM6MiJ9',
          },
        },
      }),
    })

    expect(parentContext).toBeDefined()
    expect(parentContext!.toTraceId()).toEqual('1033285593338355165') // Got this value from base64 decoding the Value in MessageAttributes
  })

  it('should extract trace from http_headers format', () => {
    const parentContext = extractParentContextFromSqsMessage({
      MessageAttributes: {
        _datadog: {
          DataType: 'String',
          StringValue: JSON.stringify({
            'x-datadog-trace-id': '7770471152178172537',
            'x-datadog-parent-id': '2722245860809486348',
            'x-datadog-sampling-priority': '2',
            traceparent:
              '00-00000000000000006bd64257db001279-25c75c2ff4d3b00c-01',
            tracestate: 'dd=s:2',
          }),
        },
      },
    })

    expect(parentContext).toBeDefined()
    expect(
      tracer
        .startSpan('test', { childOf: parentContext })
        .context()
        .toTraceId(),
    ).toEqual('7770471152178172537')
    expect(parentContext!.toTraceId()).toEqual('7770471152178172537')
  })
})

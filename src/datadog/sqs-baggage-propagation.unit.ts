import { describe } from 'node:test'
import { extractParentContext } from './sqs-baggage-propagation'

describe('extractParentContext', () => {
  it.skip('should extract trace from messages sent by sns without raw message delivery enabled', () => {
    const parentContext = extractParentContext({
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
})

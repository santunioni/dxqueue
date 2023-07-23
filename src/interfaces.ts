export interface DXQueueMessage {
  readonly groupId?: string
  error(error: unknown): Promise<void>
  process(): Promise<void>
}

export interface BatchProcessor {
  processMessages(messages: DXQueueMessage[]): Promise<void>
}

/**
 * Consume messages from the queue
 * @returns the number of messages consumed
 */
export interface Consumer {
  consume(): Promise<number>
}

export interface Publisher<P extends unknown[]> {
  publish(...params: P): Promise<void>
}

export interface DXQueueMessage {
  readonly groupId?: string
  ack(): Promise<void>
  error(error: unknown): Promise<void>
  process(): Promise<void>
}

export interface BatchProcessor {
  processMessages(messages: DXQueueMessage[]): Promise<void>
}

export interface Consumer {
  consume(): Promise<void>
}

export interface Publisher<P extends any[]> {
  publish(...params: P): Promise<void>
}

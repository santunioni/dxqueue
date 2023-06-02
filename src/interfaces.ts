export interface Logger {
  debug(...content: any[]): void
  warn(...content: any[]): void
  error(...content: any[]): void
}

export interface DXQueueMessage {
  readonly groupId?: string
  ack(): Promise<void>
  error(error: any): Promise<void>
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

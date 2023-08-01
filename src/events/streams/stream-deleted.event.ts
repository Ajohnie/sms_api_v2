export class StreamDeletedEvent {
  streamId: string;

  constructor(streamId: string) {
    this.streamId = streamId;
  }
}
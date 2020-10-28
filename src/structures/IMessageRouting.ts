export interface IMessageRouting {
  id?: string,
  channel?: string,
  streamId?: string,
  publisherId?: string,
  previousPublisherId?: string,
  subscriberId?: string
}

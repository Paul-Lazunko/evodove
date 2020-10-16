import { EPublishType } from '../constants';

export interface IMessageOptions {
  ttl?: number,
  type?: EPublishType,
  waitSubscribers?: boolean
}

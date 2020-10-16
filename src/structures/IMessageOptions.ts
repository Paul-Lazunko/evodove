import { EMessageType } from '../constants';

export interface IMessageOptions {
  ttl?: number,
  type?: EMessageType
}

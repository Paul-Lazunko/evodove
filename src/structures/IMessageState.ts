import { EMessageStatus } from '../constants';

export interface IMessageState {
  status: EMessageStatus,
  error?: string
  receivedAt?: number,
  enqueuedAt?: number,
  deliveredAt?: number,
  handledAt?: number,
}

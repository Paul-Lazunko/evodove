import { IMessage } from '../structures';

export interface IQueueHandlerOptions {
  handler: (message: IMessage) => void
}

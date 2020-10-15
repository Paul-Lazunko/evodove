import { ERequestType } from '../constants';
import { IMessageOptions } from './IMessageOptions';
import { IMessageRouting } from './IMessageRouting';
import { IMessageState } from './IMessageState';

export interface IMessage {
  type: ERequestType,
  routing: IMessageRouting,
  options?: IMessageOptions,
  inputParams: any,
  outputParams?: any,
  state?: IMessageState,
}

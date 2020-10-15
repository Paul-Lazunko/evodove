import { ERequestType } from "../constants";
import { IMessageOptions, IMessageRouting } from "../structures";

export interface IFMessageConstructParams {
  channel?: string,
  type: ERequestType,
  routing?: Partial<IMessageRouting>,
  options?: IMessageOptions,
  inputParams?: any
}

import { Readable } from "stream";
import { IClientOptions } from './IClientOptions';

export interface IClientConnectionOptions extends IClientOptions {
  subscribers: Map<string, (inputParams: any) => any >
  listeners: Map<string, (stream: Readable) => any >
}

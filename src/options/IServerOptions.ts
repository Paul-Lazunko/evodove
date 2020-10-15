import { IMessage } from '../structures';

export interface IServerOptions {
  port: number,
  requestHandler: (message: IMessage) => void,
  disconnectHandler: (id: string) => void
}

import { EMessageType, ERequestType } from "../constants";
import { IClientOptions } from "../options";
import { IMessage, IMessageOptions } from "../structures";
import { Connection } from "./connection";
import { FMessage } from "./factory";

export class NoBroClient {
  private options: IClientOptions;
  private connection: Connection;
  private subscribers: Map<string, (outputParams: any) => any>;

  constructor(options: IClientOptions) {
    this.options = options;
    this.subscribers = new Map<string, (outputParams: any) => any>();
    this.connection = new Connection({
      subscribers: this.subscribers, ...options });
  }

  public connect() {
    return this.connection.connect();
  }

  public disconnect() {
    return this.connection.disconnect();
  }

  public subscribe(channel: string, handler: (outputParams: any) => any ): void {
    this.subscribers.set(channel, handler);
  }

  public publish(channel: string, inputParams: any, options?: IMessageOptions): Promise<IMessage> {
    options = options || { type:  EMessageType.DIRECT };
    const message: IMessage = FMessage.construct({
      channel,
      inputParams,
      options,
      type: ERequestType.PUBLISH
    });
    return this.connection.send(message);
  }

  public request(channel: string, inputParams: any, options?: IMessageOptions): Promise<IMessage> {
    if ( !options ) {
      options =  { type:  EMessageType.REQUEST };
    } else {
      options.type = EMessageType.REQUEST;
    }
    const message: IMessage = FMessage.construct({
      channel,
      inputParams,
      options,
      type: ERequestType.REQUEST
    });
    return this.connection.send(message);
  }

}

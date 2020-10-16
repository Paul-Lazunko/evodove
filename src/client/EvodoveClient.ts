import {
  DEFAULT_CLIENT_DO_RECONNECT_ON_CLOSE,
  DEFAULT_CLIENT_RECONNECT_INTERVAL, DEFAULT_CLIENT_REQUEST_TIMEOUT,
  EPublishType,
  ERequestType
} from '../constants';
import { IClientOptions } from '../options';
import { IMessage, IMessageOptions } from '../structures';
import { Validator } from '../validator';
import { Connection } from './connection';
import { FMessage } from './factory';

export class EvodoveClient {
  private options: IClientOptions;
  private connection: Connection;
  private subscribers: Map<string, (inputParams: any) => any>;

  constructor(options: IClientOptions) {
    Validator.validateClientOptions(options);
    if ( !Object.hasOwnProperty.call(options, [ 'doReconnectOnClose' ]) ) {
      options.doReconnectOnClose = DEFAULT_CLIENT_DO_RECONNECT_ON_CLOSE;
    }
    if ( !Object.hasOwnProperty.call(options, [ 'reconnectInterval' ]) ) {
      options.reconnectInterval = DEFAULT_CLIENT_RECONNECT_INTERVAL;
    }
    if ( !Object.hasOwnProperty.call(options, [ 'requestTimeout' ]) ) {
      options.requestTimeout = DEFAULT_CLIENT_REQUEST_TIMEOUT;
    }
    this.options = options;
    this.subscribers = new Map<string, (inputParams: any) => any>();
    this.connection = new Connection({ subscribers: this.subscribers, ...options });
  }

  public connect(): Promise<void> {
    return this.connection.connect();
  }

  public disconnect(): void {
    return this.connection.disconnect();
  }

  public subscribe(channel: string, handler: (outputParams: any) => any ): void {
    Validator.validateChannel(channel);
    Validator.validateHandler(handler);
    this.subscribers.set(channel, handler);
  }

  public publish(channel: string, inputParams: any, options?: IMessageOptions): Promise<any> {
    Validator.validateChannel(channel);
    Validator.validateInputParams(inputParams);
    options = options || { type:  EPublishType.DIRECT };
    Validator.validateMessageOptions(options);
    const message: IMessage = FMessage.construct({
      channel,
      inputParams,
      options,
      type: ERequestType.PUBLISH
    });
    return  this.connection.send(message);
  }

  public request(channel: string, inputParams: any): Promise<any> {
    Validator.validateChannel(channel);
    Validator.validateInputParams(inputParams);
    const message: IMessage = FMessage.construct({
      channel,
      inputParams,
      type: ERequestType.REQUEST
    });
    return this.connection.send(message);
  }

}

import { Readable } from 'stream';
import {
  DEFAULT_CLIENT_DO_RECONNECT_ON_CLOSE,
  DEFAULT_CLIENT_RECONNECT_INTERVAL,
  DEFAULT_CLIENT_REQUEST_TIMEOUT,
  EPublishType,
  ERequestType
} from '../constants';
import { randomString } from '../helpers';
import { IClientOptions } from '../options';
import { OutgoingStream } from '../stream';
import { IMessage, IMessageOptions, INumberedChunk } from '../structures';
import { Validator } from '../validator';
import { Connection } from './connection';
import { FMessage } from './factory';

export class EvodoveClient {
  private options: IClientOptions;
  private connection: Connection;
  private readonly subscribers: Map<string, (inputParams: any) => any>;
  private readonly listeners: Map<string, (stream: Readable, meta: { [ key: string ]: any }) => any>;

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
    this.listeners = new Map<string, (stream: Readable) => any>();
    this.connection = new Connection({
      subscribers: this.subscribers,
      listeners: this.listeners,
      ...options
    });
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

  public onStream(channel: string, handler: (stream: Readable, meta: { [key: string]: any }) => any ): void {
    Validator.validateChannel(channel);
    Validator.validateHandler(handler);
    this.listeners.set(channel, handler);
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

  protected getStreamHandler(channel: string, streamId: string, type: ERequestType, resolver?: (...args: any[]) => any ) {
    return (chunk?: INumberedChunk) => {
      const message = FMessage.construct({
        type,
        channel,
        routing: {
          streamId
        },
        inputParams: type === ERequestType.STREAM_CHUNK ? chunk : {}
      });
      return this.connection.send(message);
    }
  }

  public stream(channel: string, stream: Readable, meta: { [key: string]: any }) {
    return new Promise((resolve, reject) => {
      const streamId: string = randomString(32, true);
      const outgoingStream: OutgoingStream = new OutgoingStream({
        onWrite: this.getStreamHandler(channel, streamId, ERequestType.STREAM_CHUNK).bind(this),
        onEnd: this.getStreamHandler(channel, streamId, ERequestType.STREAM_END, resolve).bind(this),
        onCancel: this.getStreamHandler(channel, streamId, ERequestType.STREAM_CANCEL, reject).bind(this)
      });
      const message = FMessage.construct({
        channel,
        type: ERequestType.STREAM_START,
        routing: {
          streamId
        },
        inputParams: meta
      });
      this.connection.send(message)
        .then(() => {
          stream.on('error', () => {
            outgoingStream.cancel();
          })
          stream.pipe(outgoingStream);
        })
        .catch((error: Error) => {
          reject(error)
        })
    })
  }

}

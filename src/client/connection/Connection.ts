import { EventEmitter } from 'events';
import { Socket } from 'net';
import { EMessageStatus, ERequestType } from '../../constants';
import { CryptoHelper } from '../../helpers';
import { IClientConnectionOptions } from '../../options/IClientConnectionOptions';
import { IncomingStream } from '../../stream';
import { IMessage } from '../../structures';
import { FMessage } from '../factory';

export class Connection {
  public isConnected: boolean;
  private socket: Socket;
  private eventEmitter: EventEmitter;
  private options: IClientConnectionOptions;
  private isStarted: boolean;
  private timeouts: Map<string, NodeJS.Timer>;
  private rawDataString: string;
  private reconnectTimeout: any;
  private previousPublisherId: string;
  private publisherId: string;
  private enqueuedMessages: IMessage[];
  private streams: Map<string, IncomingStream>;
  private streamsMeta: Map<string, { [key: string]: any }>;

  constructor(options: IClientConnectionOptions) {
    const self = this;
    this.enqueuedMessages = [];
    this.options = options;
    this.rawDataString = '';
    this.timeouts = new Map<string, any>();
    this.streams = new Map<string, IncomingStream>();
    this.streamsMeta = new Map<string, {[p: string]: any}>();
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.addListener('reconnect', () => {
      // @ts-ignore
      if ( this.isStarted && !this.reconnectTimeout  ) {
        this.setSocket();
        this.reconnectTimeout = setTimeout(()=> {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = undefined;
          this.socket.connect({ host: options.host, port: options.port  });
        }, options.reconnectInterval)
      }
    });
    this.eventEmitter.addListener('afterConnect', async () => {
      this.options.subscribers.forEach( (subscriber: any, channel: string) => {
        self.subscribe(channel);
      });
      this.options.listeners.forEach( (listeners: any, channel: string) => {
        self.onStream(channel);
      });
      await this.setup();
      while(this.enqueuedMessages.length) {
        const message = this.enqueuedMessages.shift();
        this.write(message);
      }
    });
  }

  protected setSocket() {
    this.socket = new Socket();
    this.socket.addListener('connect', () => {
      this.isConnected = true;
      this.eventEmitter.emit('afterConnect')
    });
    this.socket.on('data',  this.onData.bind(this));
    this.socket.on('error',  (error) => {
      this.isConnected = false;
      if ( this.options.doReconnectOnClose ) {
        this.eventEmitter.emit('reconnect')
      }
    });
    this.socket.addListener('close', () => {
      this.isConnected = false;
      if ( this.publisherId ) {
        this.previousPublisherId = this.publisherId.toString();
      }
      if ( this.options.doReconnectOnClose ) {
        this.eventEmitter.emit('reconnect')
      }
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setSocket();
        this.socket.connect({ host: this.options.host, port: this.options.port  });
        this.isStarted = true;
        resolve();
      } catch(e) {
        reject(e)
      }
    })
  }

  public disconnect(): void {
    this.isStarted = false;
    this.isConnected = false;
    this.socket.destroy();
  }

  public async subscribe(channel: string): Promise<void> {
    const message: IMessage = FMessage.construct({ channel, type: ERequestType.SUBSCRIBE });
    await this.send(message);
  }

  public async unsubscribe(channel: string): Promise<void> {
    const message: IMessage = FMessage.construct({ channel, type: ERequestType.UNSUBSCRIBE });
    await this.send(message);
  }

  public async onStream(channel: string): Promise<void> {
    const message: IMessage = FMessage.construct({ channel, type: ERequestType.LISTEN });
    await this.send(message);
  }

  public async offStream(channel: string): Promise<void> {
    const message: IMessage = FMessage.construct({ channel, type: ERequestType.DONT_LISTEN });
    await this.send(message);
  }

  private  async onData(data: string): Promise<void> {
    let message: IMessage;
    const dataString: string = data.toString();
    let dataStringGroup: string[] = [];

    if ( dataString.match('\n') ) {
      dataStringGroup = dataString.split('\n');
    } else {
      dataStringGroup = [ dataString ]
    }
    for (let i = 0; i < dataStringGroup.length; i = i + 1) {
      if ( dataStringGroup[i] ) {
        try {
          const decryptedData: string = this.rawDataString.length
            ? CryptoHelper.decrypt(this.options.secureKey, this.rawDataString + dataStringGroup[i])
            : CryptoHelper.decrypt(this.options.secureKey, dataStringGroup[i]);

          message = JSON.parse(decryptedData);
          const { type, routing, state, inputParams, options } = message;
          const handler = this.options.subscribers.get(routing.channel);
          const hasError: boolean = state && state.hasOwnProperty('error');
          if ( hasError ) {
            this.eventEmitter.emit(`error-${routing.id}`, state.error);
          } else {
            this.eventEmitter.emit(`response-${routing.id}`, message);
          }

          switch ( type ) {
            case ERequestType.ACCEPT:
              this.publisherId = routing.publisherId;
              break;
            case ERequestType.REQUEST:
            case ERequestType.PUBLISH:
              if ( handler ) {
                try {
                  if ( message.state ) {
                    message.state.deliveredAt = new Date().getTime();
                  }
                  if ( type === ERequestType.REQUEST ) {
                    message.outputParams = await handler(inputParams);
                    message.type = ERequestType.RESPONSE;
                    await this.send(message);
                  } else {
                    await handler(inputParams);
                  }
                  if ( message.state ) {
                    message.state.handledAt = new Date().getTime();
                  }
                } catch(e) {
                  if ( message.state ) {
                    message.state.error = e.message;
                    message.state.status = EMessageStatus.DECLINED;
                  }
                }
              }
              break;
            case ERequestType.STREAM_START:
              this.streams.set(routing.streamId, new IncomingStream({}));
              this.streamsMeta.set(routing.streamId, inputParams);
              break;
            case ERequestType.STREAM_CHUNK:
              if ( this.streams.has(routing.streamId) ) {
                const parsedParams = JSON.parse(inputParams);
                const buffer: Buffer = Buffer.from(parsedParams.data)
                this.streams.get(routing.streamId).write(buffer);
              }
              break;
            case ERequestType.STREAM_END:
              if ( this.streams.has(routing.streamId) ) {
                const stream: IncomingStream = this.streams.get(routing.streamId);
                const handler = this.options.listeners.get(routing.channel);
                const meta = this.streamsMeta.get(routing.streamId);
                await handler(stream.restore(), meta);
                this.streams.get(routing.streamId).end();
                this.streams.delete(routing.streamId);
                this.streamsMeta.delete(routing.streamId);
              }
              break;
            case ERequestType.STREAM_CANCEL:
              if ( this.streams.has(routing.streamId) ) {
                this.streams.delete(routing.streamId);
                this.streamsMeta.delete(routing.streamId);
              }
              break;
          }
          this.rawDataString = '';
        } catch(e) {
          this.rawDataString += dataStringGroup[i];
        }
      }
    }

  }

  public send(message: IMessage, resolver?: (...args: any[]) => any): Promise<IMessage> {
    const { routing } = message;
    return new Promise((resolve, reject) => {
      this.timeouts.set(routing.id, setTimeout(() => {
        reject(new Error(`Request timeout ${this.options.requestTimeout}ms exceeded`));
        this.eventEmitter.removeAllListeners(`response-${routing.id}`);
      }, this.options.requestTimeout));
      this.eventEmitter.addListener(`response-${routing.id}`, (message: IMessage) => {
        clearTimeout(this.timeouts.get(routing.id));
        this.timeouts.delete(routing.id);
        this.eventEmitter.removeAllListeners(`response-${routing.id}`);
        this.eventEmitter.removeAllListeners(`error-${routing.id}`);
        if ( resolver ) {
          resolver();
        }
        resolve(message.outputParams);
      });
      this.eventEmitter.addListener(`error-${routing.id}`, (error: string) => {
        clearTimeout(this.timeouts.get(routing.id));
        this.timeouts.delete(routing.id);
        this.eventEmitter.removeAllListeners(`response-${routing.id}`);
        this.eventEmitter.removeAllListeners(`error-${routing.id}`);
        return reject(new Error(error));
      });
      if ( this.isConnected && !this.socket.destroyed ) {
        this.write(message);
      } else {
        this.enqueuedMessages.push(message);
      }
    })
  }

  private async setup() {
    if ( this.previousPublisherId ) {
      const message: IMessage = FMessage.construct({
        type: ERequestType.SETUP,
        routing: {
          previousPublisherId: this.previousPublisherId
        }
      });
      await this.send(message);
    }
  }

  private write(message: IMessage):void {
    const data: string = CryptoHelper.encrypt(this.options.secureKey, JSON.stringify(message));
    this.socket.write(data + '\n');
  }

}

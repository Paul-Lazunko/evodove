import { EventEmitter } from 'events';
import { Socket } from 'net';
import { EMessageStatus, ERequestType } from '../../constants';
import { CryptoHelper } from '../../helpers';
import { IClientConnectionOptions } from '../../options/IClientConnectionOptions';
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

  constructor(options: IClientConnectionOptions) {
    const self = this;
    this.enqueuedMessages = [];
    this.options = options;
    this.rawDataString = '';
    this.timeouts = new Map<string, any>();
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
        const message: IMessage = FMessage.construct({ channel, type: ERequestType.SUBSCRIBE });
        self.send(message).catch(console.log)
      });
      await this.setup();
      while(this.enqueuedMessages.length) {
        const message = this.enqueuedMessages.shift();
        this.write(message);
      }
    })
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
        this.isStarted = true;
        this.socket.connect({ host: this.options.host, port: this.options.port  });
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

  private  async onData(data: string): Promise<void> {
    let message: IMessage;
    let dataString: string = data.toString();
    let dataStringGroup: string[] = [];
    if ( dataString.match('\n') ) {
      dataStringGroup = dataString.split('\n');
    }
    for (let i=0; i < dataStringGroup.length; i = i + 1) {
      try {
        let decryptedData: string = this.rawDataString.length
          ? CryptoHelper.decrypt(this.options.secureKey, this.rawDataString + dataStringGroup[i])
          : CryptoHelper.decrypt(this.options.secureKey, dataStringGroup[i]);

        message = JSON.parse(decryptedData);

        const { type, routing, state, inputParams, options } = message;
        const handler = this.options.subscribers.get(routing.channel);

        this.rawDataString = '';
        switch ( type ) {
          case ERequestType.RESPONSE:
          case ERequestType.SUBSCRIBE:
          case ERequestType.SETUP:
            const hasError: boolean = state.hasOwnProperty('error');
            if ( hasError ) {
              this.eventEmitter.emit(`error-${routing.id}`, state.error);
            } else {
              this.eventEmitter.emit(`response-${routing.id}`, message);
            }
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
                } else {
                  await handler(inputParams)
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
              message.type = ERequestType.RESPONSE;
              this.send(message);
            }
            break;
        }
      } catch(e) {
        this.rawDataString += dataStringGroup[i];
      }
    }

  }

  public send(message: IMessage): Promise<IMessage> {
    const { routing } = message;
    return new Promise((resolve, reject) => {
      if ( ![ ERequestType.RESPONSE, ERequestType.SETUP, ERequestType.SUBSCRIBE ].includes(message.type) ) {
        this.timeouts.set(routing.id, setTimeout(() => {
          reject(new Error(`Request timeout ${this.options.requestTimeout}ms exceeded`));
          this.eventEmitter.removeAllListeners(`response-${routing.id}`);
        }, this.options.requestTimeout));
        this.eventEmitter.addListener(`response-${routing.id}`, (message: IMessage) => {
          clearTimeout(this.timeouts.get(routing.id));
          this.timeouts.delete(routing.id);
          this.eventEmitter.removeAllListeners(`response-${routing.id}`);
          this.eventEmitter.removeAllListeners(`error-${routing.id}`);
          resolve(message.outputParams);
        });
        this.eventEmitter.addListener(`error-${routing.id}`, (error: string) => {
          clearTimeout(this.timeouts.get(routing.id));
          this.timeouts.delete(routing.id);
          this.eventEmitter.removeAllListeners(`response-${routing.id}`);
          this.eventEmitter.removeAllListeners(`error-${routing.id}`);
          return reject(new Error(error));
        });
      } else {
        resolve();
      }
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

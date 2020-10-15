import { EventEmitter } from 'events';
import { Socket } from 'net';
import { EMessageStatus, EMessageType, ERequestType } from "../../constants";
import { CryptoHelper } from '../../helpers';
import { IClientConnectionOptions } from "../../options/IClientConnectionOptions";
import { IMessage } from '../../structures';
import { FMessage } from "../factory";

export class Connection {
  public isConnected: boolean;
  private socket: Socket;
  private eventEmitter: EventEmitter;
  private options: IClientConnectionOptions;
  private isStarted: boolean;
  private timeouts: Map<string, NodeJS.Timer>;
  private rawDataString: string;
  private reconnectTimeout: any;
  private previousProducerId: string;
  private producerId: string;

  constructor(options: IClientConnectionOptions) {
    this.options = options;
    this.rawDataString = '';
    this.timeouts = new Map<string, any>();
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.addListener('reconnect', () => {
      // @ts-ignore
      if ( this.isStarted && ! this.reconnectTimeout  ) {
        this.setSocket();
        this.reconnectTimeout = setTimeout(()=> {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = undefined;
          this.socket.connect({ host: options.host, port: options.port  });
        }, options.reconnectInterval)
      }
    });
    this.eventEmitter.addListener('afterConnect', async () => {
      this.options.subscribers.forEach((subscriber: (message: IMessage)=> any, channel: string) => {
        const message: IMessage = FMessage.construct({ channel, type: ERequestType.SUBSCRIBE });
        this.send(message).catch(console.log);
      });
      await this.setup();
    })
  }

  protected setSocket() {
    this.socket = new Socket();
    this.socket.addListener('connect', () => {
      this.isConnected = true;
      this.eventEmitter.emit('connect')
    });
    this.socket.on('data',  this.onData.bind(this));
    this.socket.on('error',  (error) => {
      this.eventEmitter.emit('reconnect')
    });
    this.socket.addListener('close', () => {
      this.isConnected = false;
      this.previousProducerId = this.producerId.toString();
      if ( this.options.doReconnectOnClose ) {
        this.eventEmitter.emit('reconnect')
      }
    });
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setSocket();
      this.isStarted = true;
      this.socket.connect({ host: this.options.host, port: this.options.port  });
      this.eventEmitter.on('connect', () => {
        this.eventEmitter.emit('afterConnect');
        resolve();
      });
      this.socket.addListener('error', (error: any) => {
        reject(error);
      });
    })
  }

  public disconnect(): void {
    this.isStarted = false;
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
            clearTimeout(this.timeouts.get(routing.id));
            this.timeouts.delete(routing.id);
            const hasError: boolean = state.hasOwnProperty('error');
            if ( hasError ) {
              this.eventEmitter.emit(`error-${routing.id}`, state.error);
            } else {
              this.eventEmitter.emit(`response-${routing.id}`, message);
            }
            this.producerId = routing.producerId;
            break;
          case ERequestType.REQUEST:
            clearTimeout(this.timeouts.get(routing.id));
            this.timeouts.delete(routing.id);
            if ( handler ) {
              message.type = ERequestType.RESPONSE;
              try {
                if ( message.state ) {
                  message.state.deliveredAt = new Date().getTime();
                }
                message.outputParams = await handler(message);
                if ( message.state ) {
                  message.state.handledAt = new Date().getTime();
                }
              } catch(e) {
                if ( message.state ) {
                  message.state.error = e.message;
                  message.state.status = EMessageStatus.DECLINED;
                }
              }
              this.send(message);
            }
            break;
          case ERequestType.PUBLISH:
            clearTimeout(this.timeouts.get(routing.id));
            this.timeouts.delete(routing.id);
            if ( handler ) {
              try {
                if ( message.state ) {
                  message.state.deliveredAt = new Date().getTime();
                }
                await handler(message);
                if ( message.state ) {
                  message.state.handledAt = new Date().getTime();
                }
              } catch(e) {
                if ( message.state ) {
                  message.state.error = e.message;
                  message.state.status = EMessageStatus.DECLINED;
                }
              }
              if ( message.options.type === EMessageType.DIRECT ) {
                message.type = ERequestType.RESPONSE;
                this.send(message);
              }
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
      if ( message.type !== ERequestType.RESPONSE ) {
        this.timeouts.set(routing.id, setTimeout(() => {
          reject(new Error(`Request timeout ${this.options.requestTimeout}ms exceeded`));
          this.eventEmitter.removeAllListeners(`response-${routing.id}`);
        }, this.options.requestTimeout));
        this.eventEmitter.addListener(`response-${routing.id}`, (message: IMessage) => {
          this.eventEmitter.removeAllListeners(`response-${routing.id}`);
          this.eventEmitter.removeAllListeners(`error-${routing.id}`);
          resolve(message.outputParams);
        });
        this.eventEmitter.addListener(`error-${routing.id}`, (error: string) => {
          this.eventEmitter.removeAllListeners(`response-${routing.id}`);
          this.eventEmitter.removeAllListeners(`error-${routing.id}`);
          return reject(new Error(error));
        });
      } else {
        resolve();
      }
      this.write(message);
    })
  }

  private async setup() {
    if ( this.previousProducerId ) {
      const message: IMessage = FMessage.construct({
        type: ERequestType.SETUP,
        routing: {
          previousProducerId: this.previousProducerId
        }
      });
      await this.send(message);
    }
  }

  private write(message: IMessage):void {
    const data = CryptoHelper.encrypt(this.options.secureKey, JSON.stringify(message));
    this.socket.write(data + '\n');
  }

}

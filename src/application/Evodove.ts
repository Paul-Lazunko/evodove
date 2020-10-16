import { config } from '../config';
import {
  EMessageStatus,
  EPublishType,
  ERequestType,
  STORE_MESSAGE_BUFFER_KEY, STORE_REQUEST_QUEUES_KEY, STORE_RESPONSE_QUEUES_KEY,
  STORE_ROOT_KEY,
  STORE_STORAGE_ROOT_KEY
} from '../constants';
import { IMessage } from '../structures';
import { FError } from '../error';
import { RequestQueueHandler, ResponseQueueHandler } from '../queue';
import { EvodoveServer } from '../server';
import {
  addStoreHandler
} from '../eventEmmitter';
import { store } from '../store';
import { Validator } from '../validator';

export class Evodove {
  public consumers: Map<string, string[]>;
  public lostProducersTimeouts: Map<string, number>;
  public lostProducers: Map<string, string>;
  public messageBuffer: Map<string, IMessage>;
  protected server: EvodoveServer;

  constructor() {
    this.validateConfiguration();
    this.consumers = new Map<string, string[]>();
    this.lostProducers = new Map<string, string>();
    this.lostProducersTimeouts = new Map<string, number>();
    this.messageBuffer = new Map<string, IMessage>();
    this.server = new EvodoveServer({
      port: config.port,
      requestHandler: this.enQueueRequest.bind(this),
      disconnectHandler: this.deleteConsumer.bind(this)
    });
    RequestQueueHandler.initInstances({
      handler: this.processMessage.bind(this)
    }, config.workersCount);
    ResponseQueueHandler.initInstances({
      handler: this.responseHandler.bind(this)
    },  config.workersCount);
    try {
      this.restore()
    } catch(e) {
      console.log(`Restore Error: ${e.message}`);
    }
    this.initStore();
  }

  protected get requestQueueHandler(): RequestQueueHandler {
    return RequestQueueHandler.getInstance();
  }

  protected get responseQueueHandler(): ResponseQueueHandler {
    return ResponseQueueHandler.getInstance();
  }

  protected validateConfiguration() {
    Validator.validateServerOptions(config);
  }

  public start() {
    ResponseQueueHandler.start();
    RequestQueueHandler.start();
    this.server.start();
  }

  public stop() {
    this.responseQueueHandler.stop();
    this.requestQueueHandler.stop();
    this.server.stop();
  }

  protected enQueueRequest(message: IMessage) {
    message.state.enqueuedAt = new Date().getTime();
    this.requestQueueHandler.enQueue(message);
  }

  protected responseHandler(message: IMessage) {
    const isSent: boolean = this.server.makeResponse(message);
    if ( !isSent ) {
      if ( this.lostProducers.has(message.routing.producerId) ) {
        message.routing.producerId = this.lostProducers.get(message.routing.producerId);
      }
      const timestamp: number =  new Date().getTime();
      if ( !this.lostProducersTimeouts.has(message.routing.producerId) ) {
        this.lostProducersTimeouts.set(message.routing.producerId,timestamp)
      }
      if ( timestamp - this.lostProducersTimeouts.get(message.routing.producerId) < config.storeRequestValueMs ) {
        this.enQueueResponse(message);
      }
    }
  }

  public setConsumer(key: string, id: string): void {
    if ( !this.consumers.has(key) ) {
      this.consumers.set(key, []);
    }
    this.consumers.get(key).push(id);
  }

  public deleteConsumer(id: string) {
    this.consumers.forEach((consumer: string[], channel: string) => {
      if ( consumer.includes(id) ) {
        consumer.splice(consumer.indexOf(id), 1);
      }
      if ( !consumer.length ) {
        this.consumers.delete(channel);
      }
    });
  }

  protected enQueueResponse(message: IMessage) {
    this.responseQueueHandler.enQueue(message)
  }

  protected processMessage(message: IMessage): void {
    const {
      type,
      options,
      state,
      routing,
      outputParams
    } = message;
    const { producerId, channel, id } = routing;
    const sockets: string[] = this.consumers.get(channel);
    const timestamp: number = new Date().getTime();
    try {
      Validator.validateMessage(message);
      switch(type) {
        case ERequestType.REQUEST:
          if ( !sockets || !sockets.length ) {
            throw FError.subscriberExistenceError(channel);
          }
          const index: number = Math.round(Math.random() * (sockets.length - 1));
          const socket = sockets [ index ];
          message.routing.consumerId = socket;
          message.state.enqueuedAt = timestamp;
          this.messageBuffer.set(id, message);
          this.server.makeRequest(
            [ socket ],
            message,
            this.enQueueRequest.bind(this)
          );
          break;
        case ERequestType.PUBLISH:
          if ( !sockets || !sockets.length ) {
           throw FError.subscriberExistenceError(channel);
          }
          if ( options.type === EPublishType.BROADCAST ) {
            this.server.makeRequest(sockets, message);
            message.type = ERequestType.RESPONSE;
            message.state.enqueuedAt = timestamp;
            message.state.deliveredAt = timestamp;
            message.state.handledAt = timestamp;
            this.enQueueResponse(message);
          } else {
            message.state.enqueuedAt = timestamp;
            this.messageBuffer.set(id, message);
            const index: number = Math.round(Math.random() * (sockets.length - 1));
            const socket = sockets [ index ];
            this.server.makeRequest(
              [ socket ],
              message,
              this.enQueueRequest.bind(this)
            );
          }
          break;
        case ERequestType.RESPONSE:
          const storedMessage: IMessage = this.messageBuffer.get(id);
          storedMessage.outputParams = outputParams;
          storedMessage.type = ERequestType.RESPONSE;
          storedMessage.state.deliveredAt = state.deliveredAt;
          storedMessage.state.handledAt = state.handledAt;
          this.enQueueResponse(Object.assign({}, storedMessage));
          this.messageBuffer.delete(id);
          break;
        case ERequestType.SUBSCRIBE:
          this.setConsumer(channel, producerId);
          message.state.enqueuedAt = timestamp;
          message.state.deliveredAt = timestamp;
          message.state.handledAt = timestamp;
          this.enQueueResponse(message);
          break;
        case ERequestType.SETUP:
          if ( routing.previousProducerId ) {
            this.resetProducerId(routing.producerId, routing.previousProducerId);
          }
          message.state.deliveredAt = timestamp;
          message.state.enqueuedAt = timestamp;
          message.state.handledAt = timestamp;
          this.enQueueResponse(message);
          break;
        default:
          throw FError.messageTypeError(type);
      }
    } catch(e) {
      message.state.status = EMessageStatus.DECLINED;
      message.state.error = e.message;
      this.enQueueResponse(message);
    }
  }
  protected resetProducerId(producerId: string, previousProducerId: string) {
    this.lostProducers.forEach((id: string, key: string) => {
      if ( id === previousProducerId ) {
        this.lostProducers.set(key, producerId);
      }
    });
    this.lostProducers.set(previousProducerId, producerId);
    this.messageBuffer.forEach((message: IMessage) => {
      if ( message.routing.producerId === previousProducerId ) {
        message.routing.producerId = producerId;
      }
    });
  }

  protected initStore() {
   addStoreHandler(STORE_MESSAGE_BUFFER_KEY, this.getMessageBufferObject.bind(this));
   addStoreHandler(STORE_REQUEST_QUEUES_KEY, this.getRequestQueues.bind(this));
   addStoreHandler(STORE_RESPONSE_QUEUES_KEY, this.getResponseQueues.bind(this));
  }

  protected getMessageBufferObject(): { [key: string]: IMessage } {
    const messageBuffer: { [key: string]: IMessage } = {};
    this.messageBuffer.forEach((message: IMessage, key: string) => {
      messageBuffer[key] = message;
    });
    return messageBuffer
  }

  protected setMessageBufferObject(messageBuffer: { [key: string]: IMessage }) {
    for ( const key in messageBuffer ) {
      this.messageBuffer.set(key, messageBuffer[key]);
    }
  }

  protected getRequestQueues(): IMessage[][] {
    return RequestQueueHandler.getQueues();
  }

  protected setRequestQueues(queues:  IMessage[][]) {
    return RequestQueueHandler.setQueues(queues);
  }

  protected getResponseQueues(): IMessage[][] {
    return ResponseQueueHandler.getQueues();
  }

  protected setResponseQueues(queues:  IMessage[][]) {
    return ResponseQueueHandler.setQueues(queues);
  }

  protected restore() {
    const data: { [key: string]: any } = store.get(STORE_ROOT_KEY);
    if ( data[STORE_MESSAGE_BUFFER_KEY] ) {
      this.setMessageBufferObject(data[STORE_MESSAGE_BUFFER_KEY]);
    }
    if ( data[STORE_REQUEST_QUEUES_KEY] ) {
      this.setRequestQueues(data[STORE_REQUEST_QUEUES_KEY]);
    }
    if ( data[STORE_RESPONSE_QUEUES_KEY] ) {
      this.setResponseQueues(data[STORE_RESPONSE_QUEUES_KEY]);
    }
  }
}

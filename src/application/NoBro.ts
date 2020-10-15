import { config } from '../config';
import { EMessageStatus, EMessageType, ERequestType } from '../constants';
import { ErrorFactory } from '../error';
import { RequestQueueHandler, ResponseQueueHandler } from '../queue';
import { NoBroServer } from '../server';
// import { store } from '../store';
import { IMessage } from '../structures';
import { Validator } from '../validator';

export class NoBro {
  public consumers: Map<string, string[]>;
  public lostProducers: Map<string, number>;
  public messageBuffer: Map<string, IMessage>;
  protected server: NoBroServer;

  constructor() {
    this.validateConfiguration();
    this.consumers = new Map<string, string[]>();
    this.lostProducers = new Map<string, number>();
    this.messageBuffer = new Map<string, IMessage>();
    this.server = new NoBroServer({
      port: config.port,
      requestHandler: this.enQueueRequest.bind(this),
      disconnectHandler: this.deleteConsumer.bind(this)
    });
    RequestQueueHandler.initInstances({
      handler: this.processMessage.bind(this)
    }, config.workersCount);
    ResponseQueueHandler.initInstances({
      handler: this.responseHandler.bind(this)
    },  config.workersCount)
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
      const timestamp: number =  new Date().getTime();
      if ( !this.lostProducers.has(message.routing.producerId) ) {
        this.lostProducers.set(message.routing.producerId,timestamp)
      }
      if ( timestamp - this.lostProducers.get(message.routing.producerId) > config.storeRequestValueMs ) {
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
    // TODO: validate message
    const { producerId, channel, id } = routing;
    const sockets: string[] = this.consumers.get(channel);
    const timestamp: number = new Date().getTime();
    try {
      switch(type) {
        case ERequestType.REQUEST:
          if ( !sockets || !sockets.length ) {
            throw ErrorFactory.consumersExistenceError(channel);
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
           throw ErrorFactory.consumersExistenceError(channel);
          }
          if ( options.type === EMessageType.BROADCAST ) {
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
          this.enQueueResponse(storedMessage);
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
          throw ErrorFactory.messageTypeError(type);
      }
    } catch(e) {
      message.state.status = EMessageStatus.DECLINED;
      message.state.error = e.message;
      this.enQueueResponse(message);
    }
  }

  protected resetProducerId(producerId: string, previousProducerId: string) {
    this.messageBuffer.forEach((message: IMessage) => {
      if ( message.routing.producerId === previousProducerId ) {
        message.routing.producerId = producerId;
      }
    })
  }
}

export const noBro = new NoBro();

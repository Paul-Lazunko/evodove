import { config } from '../config';
let once: boolean = false;
import {
  EMessageStatus,
  EPublishType,
  ERequestType,
  EStreamHandlerType,
  STORE_MESSAGE_BUFFER_KEY,
  STORE_REQUEST_QUEUES_KEY,
  STORE_RESPONSE_QUEUES_KEY,
  STORE_ROOT_KEY
} from '../constants';
import { FError } from '../error';
import { addStoreHandler } from '../eventEmmitter';
import { RequestQueueHandler, ResponseQueueHandler } from '../queue';
import { EvodoveServer } from '../server';
import { store } from '../store';
import { IntermediateStream } from '../stream';
import { IMessage, IMessageRouting, INumberedChunk } from '../structures';
import { Validator } from '../validator';

export class Evodove {

  protected messageBuffer: Map<string, IMessage>;
  protected streams: Map<string,  Map<string, IntermediateStream>>;

  protected server: EvodoveServer;

  protected subscribers: Map<string, string[]>;
  protected listeners: Map<string, string[]>;

  protected streamListeners: Map<string, string[]>;

  protected lostPublishersTimeouts: Map<string, number>;
  protected lostPublishers: Map<string, string>;

  protected lostListenersTimeouts: Map<string, number>;
  protected lostListeners: Map<string, string>;


  constructor() {
    this.validateConfiguration();
    this.streams  = new Map<string,  Map<string, IntermediateStream>>();
    this.streamListeners = new Map<string, string[]>();
    this.messageBuffer = new Map<string, IMessage>();
    this.listeners = new Map<string, string[]>();
    this.subscribers = new Map<string, string[]>();
    this.lostPublishers = new Map<string, string>();
    this.lostPublishersTimeouts = new Map<string, number>();
    this.lostListeners = new Map<string, string>();
    this.lostListenersTimeouts = new Map<string, number>();
    this.server = new EvodoveServer({
      port: config.port,
      requestHandler: this.enQueueRequest.bind(this),
      disconnectHandler: this.disconnectHandler.bind(this)
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
    const timestamp: number =  new Date().getTime();
    if ([ ERequestType.STREAM_CHUNK,  ERequestType.STREAM_END, ERequestType.STREAM_CANCEL ].includes(message.type) ) {
      message.routing.publisherId = message.routing.subscriberId;
    }
    const isSent: boolean = this.server.makeResponse(message);
    if ( !isSent ) {
      switch (message.type) {
        case ERequestType.STREAM_CHUNK:
        case ERequestType.STREAM_END:
          if ( this.lostListeners.has(message.routing.subscriberId) ) {
            message.routing.publisherId = this.lostListeners.get(message.routing.subscriberId);
            message.routing.subscriberId = this.lostListeners.get(message.routing.subscriberId);
          }
          const { subscriberId } = message.routing;
          if ( !this.lostListenersTimeouts.has(subscriberId) ) {
            this.lostListenersTimeouts.set(subscriberId, timestamp)
          }
          if ( timestamp - this.lostListenersTimeouts.get(subscriberId) < config.storeRequestValueMs ) {
            this.enQueueResponse(message);
          } else {
            this.streamListeners.forEach((listeners: string[]) => {
              if ( listeners.includes(subscriberId) ) {
                listeners.splice(listeners.indexOf(subscriberId), 1);
              }
            });
            this.streams.forEach((holder: Map<string, IntermediateStream>) => {
              if ( holder.has(subscriberId) ) {
                const stream = holder.get(subscriberId);
                holder.delete(subscriberId);
                stream.destroy();
              }
            })
          }
          break;
        default:
          if ( this.lostPublishers.has(message.routing.publisherId) ) {
            message.routing.publisherId = this.lostPublishers.get(message.routing.publisherId);
          }
          if ( !this.lostPublishersTimeouts.has(message.routing.publisherId) ) {
            this.lostPublishersTimeouts.set(message.routing.publisherId, timestamp)
          }
          if ( timestamp - this.lostPublishersTimeouts.get(message.routing.publisherId) < config.storeRequestValueMs ) {
            this.enQueueResponse(message);
          }
          break;
      }
    }
  }

  protected setSubscriber(key: string, id: string): void {
    if ( !this.subscribers.has(key) ) {
      this.subscribers.set(key, []);
    }
    if ( !this.subscribers.get(key).includes(id) ) {
      this.subscribers.get(key).push(id);
    }
  }

  protected deleteSubscriber(id: string) {
    this.subscribers.forEach((subscribers: string[], channel: string) => {
      if ( subscribers.includes(id) ) {
        subscribers.splice(subscribers.indexOf(id), 1);
      }
      if ( !subscribers.length ) {
        this.subscribers.delete(channel);
      }
    });
  }

  protected delSubscriber(channel: string, id: string) {
    if ( this.subscribers.has(channel) ) {
      const subscribers: string[] = this.subscribers.get(channel)
      if ( subscribers.includes(id) ) {
        subscribers.splice(subscribers.indexOf(id), 1);
      }
    }
  }

  protected setListener(channel: string, id: string): void {
    if ( !this.listeners.has(channel) ) {
      this.listeners.set(channel, []);
    }
    if ( !this.listeners.get(channel).includes(id) ) {
      this.listeners.get(channel).push(id);
    }
  }

  protected delListener(channel: string, id: string): void {
    if ( this.listeners.has(channel) ) {
      const listeners: string[] = this.listeners.get(channel);
      if ( listeners.includes(channel) ) {
        listeners.splice(listeners.indexOf(id),1)
      }
    }
  }

  protected deleteListener(id: string) {
    this.listeners.forEach((listeners: string[], key: string) => {
      if ( listeners.includes(id) ) {
        listeners.splice(listeners.indexOf(id), 1);
      }
      if ( !listeners.length ) {
        this.listeners.delete(key);
      }
    });
  }

  protected disconnectHandler(id: string) {
    this.deleteListener(id);
    this.deleteSubscriber(id);
  }

  protected enQueueResponse(message: IMessage) {
    this.responseQueueHandler.enQueue(message)
  }

  protected sendAck(message: IMessage) {
    const timestamp: number = new Date().getTime();
    const m: IMessage = Object.assign({}, message);
    m.state.enqueuedAt = timestamp;
    m.state.deliveredAt = timestamp;
    m.state.handledAt = timestamp;
    m.type = ERequestType.ACCEPT;
    this.enQueueResponse(m);
  }

  protected getStreamHandler(socket: string, routing: IMessageRouting, type: EStreamHandlerType) {
    const { publisherId, channel, id, streamId } = routing;
    return (chunk?: INumberedChunk) => {
      let messageType: ERequestType;
      switch (type) {
        case EStreamHandlerType.ON_WRITE:
          messageType = ERequestType.STREAM_CHUNK
          break;
        case EStreamHandlerType.ON_END:
          messageType = ERequestType.STREAM_END
          break;
        case EStreamHandlerType.ON_CANCEL:
          messageType = ERequestType.STREAM_CANCEL
          break;
      }
      const message: IMessage = {
        type: messageType,
        routing: { publisherId, channel, id, streamId, subscriberId: socket },
        inputParams: type === EStreamHandlerType.ON_WRITE ? JSON.stringify(chunk): {}
      };
      this.server.makeRequest(
        [ socket ],
        message,
        this.responseHandler.bind(this)
      );
    }
  }

  protected processMessage(message: IMessage): void {
    const {
      type,
      options,
      state,
      routing,
      outputParams,
      inputParams
    } = message;
    const { publisherId, channel, id, streamId, previousPublisherId } = routing;
    const subscribersSockets: string[] = this.subscribers.get(channel);
    const listenersSockets: string[] = this.listeners.get(channel);
    const timestamp: number = new Date().getTime();
    try {
      Validator.validateMessage(message);
      switch(type) {
        case ERequestType.REQUEST:
          if ( !subscribersSockets || !subscribersSockets.length ) {
            throw FError.subscriberExistenceError(channel);
          }
          const index: number = Math.round(Math.random() * (subscribersSockets.length - 1));
          const socket = subscribersSockets [ index ];
          message.routing.subscriberId = socket;
          message.state.enqueuedAt = timestamp;
          this.messageBuffer.set(id, message);
          this.server.makeRequest(
            [ socket ],
            message,
            this.enQueueRequest.bind(this)
          );
          break;
        case ERequestType.PUBLISH:
          if ( !Array.isArray(subscribersSockets) || !subscribersSockets.length ) {
            if ( options.waitSubscribers ) {
              const ttl = options.ttl || 0;
              if ( message.state.receivedAt + ttl > timestamp ) {
                if ( !once ) {
                  once = true;
                }
                this.enQueueRequest(message);
              }
            } else {
              throw FError.subscriberExistenceError(channel);
            }
          } else {
            if ( options.type === EPublishType.BROADCAST ) {
              this.server.makeRequest(subscribersSockets, message);
            } else {
              message.state.enqueuedAt = timestamp;
              const index: number = Math.round(Math.random() * (subscribersSockets.length - 1));
              const socket = subscribersSockets [ index ];
              this.server.makeRequest(
                [ socket ],
                message,
                this.enQueueRequest.bind(this)
              );
            }
          }
          this.sendAck(message);
          break;
        case ERequestType.RESPONSE:
          const storedMessage: IMessage = this.messageBuffer.get(id);
          if ( storedMessage ) {
            storedMessage.outputParams = outputParams;
            storedMessage.type = ERequestType.RESPONSE;
            storedMessage.state.deliveredAt = state.deliveredAt;
            storedMessage.state.handledAt = state.handledAt;
            this.enQueueResponse(Object.assign({}, storedMessage));
            this.messageBuffer.delete(id);
          }
          this.sendAck(message);
          break;
        case ERequestType.SUBSCRIBE:
          this.setSubscriber(channel, publisherId);
          this.sendAck(message);
          break;
        case ERequestType.UNSUBSCRIBE:
          this.delSubscriber(channel, publisherId);
          this.sendAck(message);
          break;
        case ERequestType.LISTEN:
          this.setListener(channel, publisherId);
          this.sendAck(message);
          break;
        case ERequestType.DONT_LISTEN:
          this.delListener(channel, publisherId);
          this.sendAck(message);
          break;
        case ERequestType.STREAM_START:
          this.streams.set(streamId, new Map<string, IntermediateStream>());
          this.streamListeners.set(streamId, listenersSockets);
          const streams = this.streams.get(streamId);
          listenersSockets.forEach((socket: string) => {
            streams.set(socket, new IntermediateStream({
              onWrite: this.getStreamHandler(socket, routing, EStreamHandlerType.ON_WRITE).bind(this),
              onEnd: this.getStreamHandler(socket, routing, EStreamHandlerType.ON_END).bind(this),
              onCancel: this.getStreamHandler(socket, routing, EStreamHandlerType.ON_CANCEL).bind(this)
            }));
          });
          this.server.makeRequest(listenersSockets, message);
          this.sendAck(message);
          break;
        case ERequestType.STREAM_CHUNK:
          if ( this.streams.has(streamId) ) {
            this.streams.get(streamId).forEach((stream: IntermediateStream, socket: string) => {
              if ( inputParams ) {
                stream.write(Buffer.from(JSON.stringify(inputParams)));
              }
            })
          }
          this.sendAck(message);
          break;
        case ERequestType.STREAM_END:
          if ( this.streams.has(streamId) ) {
            this.streams.get(streamId).forEach((stream: IntermediateStream, socket: string) => {
              stream.end();
              this.streams.get(streamId).delete(socket);
            });
            this.streamListeners.delete(streamId);
          }
          this.sendAck(message);
          break;
        case ERequestType.STREAM_CANCEL:
          if ( this.streams.has(streamId) ) {
            this.streams.get(streamId).forEach((stream: IntermediateStream, socket: string) => {
              stream.cancel();
              this.streams.get(streamId).delete(socket);
            });
            this.streamListeners.delete(streamId);
          }
          this.sendAck(message);
          break;
        case ERequestType.SETUP:
          if ( previousPublisherId ) {
            this.resetProducerId(publisherId, previousPublisherId);
            this.resetListenerId(publisherId, previousPublisherId);
          }
          this.sendAck(message);
          break;
        default:
          throw FError.messageTypeError(type);
      }
    } catch(e) {
      console.log({ e })
      message.state.status = EMessageStatus.DECLINED;
      message.state.error = e.message;
      this.enQueueResponse(message);
    }
  }

  protected resetProducerId(producerId: string, previousProducerId: string) {
    this.lostPublishers.forEach((id: string, key: string) => {
      if ( id === previousProducerId ) {
        this.lostPublishers.set(key, producerId);
      }
    });
    this.lostPublishers.set(previousProducerId, producerId);

    this.messageBuffer.forEach((message: IMessage) => {
      if ( message.routing.publisherId === previousProducerId ) {
        message.routing.publisherId = producerId;
      }
    });
  }

  protected resetListenerId(producerId: string, previousProducerId: string) {
    this.lostListeners.forEach((id: string, key: string) => {
      if ( id === previousProducerId ) {
        this.lostPublishers.set(key, producerId);
      }
    });
    this.lostListeners.set(previousProducerId, producerId);
    this.streamListeners.forEach((listeners: string[], channel: string) => {
      if ( listeners.includes(previousProducerId) ) {
        listeners.splice(listeners.indexOf(previousProducerId),1);
        listeners.push(producerId);
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

import { IQueueHandlerOptions } from '../options';
import { IMessage } from '../structures';
import { AbstractQueueHandler } from './AbstractQueueHandler';


export class ResponseQueueHandler extends AbstractQueueHandler <IMessage> {

  protected static instances: ResponseQueueHandler[] = [];
  protected static instanceIndex: number = 0;

  public static initInstances(options: IQueueHandlerOptions, count: number) {
    for ( let i = 0; i < count; i = i + 1 ) {
      ResponseQueueHandler.instances.push(new ResponseQueueHandler(options));
    }
  }

  public static start(): void {
    ResponseQueueHandler.instances.forEach((instance: ResponseQueueHandler) => {
      instance.start();
    })
  }

  public static stop(): void {
    ResponseQueueHandler.instances.forEach((instance: ResponseQueueHandler) => {
      instance.stop();
    })
  }

  public static getInstance() {
    if ( ResponseQueueHandler.instanceIndex === ResponseQueueHandler.instances.length -1) {
      ResponseQueueHandler.instanceIndex = 0;
    } else {
      ResponseQueueHandler.instanceIndex = ResponseQueueHandler.instanceIndex + 1;
    }
    return ResponseQueueHandler.instances[ResponseQueueHandler.instanceIndex];
  }

  public static getQueues(): IMessage[][] {
    return ResponseQueueHandler.instances.map((instance: ResponseQueueHandler) => instance.getQueue());
  }

  public static setQueues (data: IMessage[][]) {
    ResponseQueueHandler.instances.forEach((instance: ResponseQueueHandler, index: number) => {
      if ( index < data.length - 1 ) {
        instance.setQueue(data[index]);
      }
    });
  }


  protected constructor(options: IQueueHandlerOptions) {
    super(options);
  }

}

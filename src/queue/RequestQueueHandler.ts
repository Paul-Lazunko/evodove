import { IQueueHandlerOptions } from '../options';
import { IMessage } from '../structures';
import { AbstractQueueHandler } from './AbstractQueueHandler';


export class RequestQueueHandler extends AbstractQueueHandler <IMessage> {

  protected static instances: RequestQueueHandler[] = [];
  protected static instanceIndex: number = 0;

  public static initInstances(options: IQueueHandlerOptions, count: number) {
    for ( let i = 0; i < count; i = i + 1 ) {
      RequestQueueHandler.instances.push(new RequestQueueHandler(options));
    }
  }

  public static start(): void {
    RequestQueueHandler.instances.forEach((instance: RequestQueueHandler) => {
      instance.start();
    })
  }

  public static stop(): void {
    RequestQueueHandler.instances.forEach((instance: RequestQueueHandler) => {
      instance.stop();
    })
  }

  public static getInstance() {
    if ( RequestQueueHandler.instanceIndex === RequestQueueHandler.instances.length - 1) {
    } else {
      RequestQueueHandler.instanceIndex = RequestQueueHandler.instanceIndex + 1;
    }
    return RequestQueueHandler.instances[RequestQueueHandler.instanceIndex];
  }

  protected constructor(options: IQueueHandlerOptions) {
    super(options);
  }

}

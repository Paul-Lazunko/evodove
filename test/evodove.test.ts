require('jest');
import { Readable } from 'stream';
import {
  EPublishType,
  Evodove,
  EvodoveClient,
  IClientOptions
} from '../src';

describe('Evodove package test suite', () => {
  const clientOptions: IClientOptions = {
    host: '127.0.0.1',
    port: 45678,
    secureKey: 'test',
    doReconnectOnClose: true,
    reconnectInterval: 1000,
    requestTimeout: 6000
  }
  const broker: Evodove = new Evodove();
  const subscriber: EvodoveClient = new EvodoveClient(clientOptions);
  const subscriber2: EvodoveClient = new EvodoveClient(clientOptions);
  const publisher: EvodoveClient = new EvodoveClient(clientOptions);

  const pubSubChannel: string = 'foo';
  const waitSubChannel: string = 'bar';
  const requestChannel: string = 'req';
  const streamChannel: string = 'stream';

  beforeAll(async() => {
    broker.start();
    await subscriber.connect();
    await subscriber2.connect();
    await publisher.connect();
  });

  it('direct pub-sub test', async (done: Function) => {
    let handleCount: number = 0;
    const expectedHandleCount: number = 1;
    await subscriber.subscribe(pubSubChannel,(params: any) => {
      handleCount = handleCount + 1;
    });
    await subscriber2.subscribe(pubSubChannel,(params: any) => {
      handleCount = handleCount + 1;
    });
    await publisher.publish(pubSubChannel, {}, { type: EPublishType.DIRECT });
    expect(handleCount).toEqual(expectedHandleCount);
    done();
  });

  it('broadcast pub-sub test', async (done: Function) => {
    let handleCount: number = 0;
    const expectedHandleCount: number = 2;
    await subscriber.subscribe(pubSubChannel,(params: any) => {
      handleCount = handleCount + 1;
    });
    await subscriber2.subscribe(pubSubChannel,(params: any) => {
      handleCount = handleCount + 1;
    });
    await publisher.publish(pubSubChannel, {}, { type: EPublishType.BROADCAST });
    expect(handleCount).toEqual(expectedHandleCount);
    done();
  });

  it('waiting subscribers (ttl) test', async(done: Function) => {
    await subscriber.unsubscribe(pubSubChannel);
    await subscriber2.unsubscribe(pubSubChannel);
    await publisher.publish(waitSubChannel, {}, {
      type: EPublishType.DIRECT,
      ttl: 2000,
      waitSubscribers: true
    });
    setTimeout(async () => {
      await subscriber.subscribe(waitSubChannel,() => {
        done();
      });
    }, 1000)
  });

  it('request test', async(done: Function) => {
    const diff: number = 5;
    const value: number = 10;
    await subscriber.subscribe(requestChannel, (outputParams: any ) => {
      const { value } = outputParams;
      return value + diff;
    });
    const result = await publisher.request(requestChannel, { value });
    expect(result).toEqual(value + diff);
    done();
  });

  it('stream test', async(done: Function) => {
    const data: any[] = [ 'a', 'b', 'c'];
    const streamData = Object.assign([], data);
    const readableStream = new Readable({
      objectMode: true,
      read() {
        const item = streamData.pop()
        if (!item) {
          this.push(null);
          return;
        }
        this.push(item)
      },
    })
    await subscriber.onStream(streamChannel, (stream: Readable, meta: any ) => {
      const receivedData: any[] = [];
      let chunk: any;
      while( chunk = stream.read()) {
        receivedData.push(chunk.toString())
      }
      expect(receivedData).toEqual(data);
      done();
    });
    await publisher.stream(streamChannel, readableStream, {});
  });

  afterAll(async() => {
    publisher.disconnect();
    subscriber.disconnect();
    broker.stop();
  });

});

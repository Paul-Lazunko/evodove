# evodove

Evodove is a Message Broker for Node.js applications. It provides next advantages to Your projects:
- **security** - clients and server interact with encrypted frames only without keys sharing and can do it over the global network without fear of data leakage
- **performance** - message delivering takes few (1-3) ms with delivering guarantee
- **stability** - server/clients are resistant to crashes and loosing connection
- **flexible** - the number of restrictions is minimal and this solution easily fits into any architecture

***

###### Package installation

```shell script

npm i -s evodove

```

###### 1. Create Server
At first You need create and run the message broker instance.
You will do it easily, and it will not take more than 2 minutes: just create a simple standalone Node.js application with few lines of code.
Here is an example (You can save example as a server.js):

```ecmascript 6

import { Evodove } from 'evodove';

const evodove = new Evodove();

evodove.start();

```
Run server with the next environment variables (with values that You need):

```shell script

EVODOVE_SERVER_PORT=45678 EVODOVE_WORKERS_COUNT=10 EVODOVE_SECURE_KEY='mySecureKey' node server.js

```

You can use next environment variables:
- **EVODOVE_SERVER_PORT** - port that will be listened by Your Message Broker instance (default is 45678);
- **EVODOVE_WORKERS_COUNT** - concurrent queues count (default is 10)
- **EVODOVE_STORE_RESPONSE_MS** - value in ms that indicates maximum time value to store responses from subscribers when publisher that created request is currently unavailable
- **EVODOVE_DATA_VOLUME** - directory to store Message Broker instance state (when it will be restarted it can continue works and delivers previously received messages)
- **EVODOVE_SECURE_KEY** - secret key that will be used to encrypt frames, the same should be used at each client side

You can use existent Docker image with evodove instance like there:
https://github.com/Paul-Lazunko/evodove-docker-example


###### 2. Create clients

The second thing is creating clients which will be parts of your distributed system (publishers and subscribers).
This is also simple:

```ecmascript 6

import { EvodoveClient } from 'evodove';

const clientOptions = {
  host: 'localhost',
  port: 45678,
  secureKey: 'mySecureKey',
  reconnectInterval: 1000,
  doReconnectOnClose: true,
  requestTimeout: 5000
};

const client = new EvodoveClient(clientOptions);

```

This is a short description of the clientOptions properties:
- **host** - the host of your message broker instance;
- **port** - port listened by your message broker instance;
- **doReconnectOnClose** - boolean that indicates do reconnect or don't;
- **reconnectInterval** - value in ms that defines interval between reconnection attempts;
- **requestTimeout** -  value in ms that defines maximal execution time for request from publisher side;
- **secureKey** - secret key, the same as at the server side;


Don't forget to connect to the message broker (server) in your code:

```ecmascript 6

    ...
    await client.connect();

    // await client.disconnect()
    ...

```

So, created clients in the same time can be publishers and subscribers.
Their can be used in the same or different applications, can subscribe to many channels etc - up to your system design and requirements.
It`s really simple and flexible!

###### 3. Subscribing process

The client can subscribe to some channel (or key, it`s just simple unique string). It can unsubscribe from the channel also.
When some data will be passed from one of the publishers to the channel, it will take the data and execute provided handler.
See the next example:

```ecmascript 6

import { EvodoveClient } from 'evodove';

const clientOptions = {
  host: 'localhost',
  port: 45678,
  secureKey: 'mySecureKey',
  reconnectInterval: 1000,
  doReconnectOnClose: true,
  requestTimeout: 5000
};

const client = new EvodoveClient(clientOptions);

await client.connect();

await client.subscribe('foo', outputParams => {
    // do something
});

```

Clients can subscribe to (and unsubscribe from) some channel dynamically, that can add flexibility to your system:

```ecmascript 6

await client.subscribe('new-user', async outputParams => {
   const { userId } = outputParams;
   await client.subscribe(`user-${userId}`, async data => {
       // do something;
     await client.unsubscribe(`user-${userId}`);
   })
});

```

###### 4. Publishing

Clients can publish to some channel some data. Publishing requires the message options, that mark how the broker should process the message.
Message can be delivered to only one subscriber (for direct mode) or to all subscribers which are connected to server and are suscribed to needed channel (broadcast mode).
If you want to publish data to non-existent at this moment channel (that will be available soon), you can add to the options **waitSubscribers**  property (set it true) and define **ttl** property in milliseconds, that notifies broker how long the broker should wait.
Note that **publish** method doesn't return anything to publisher - unlike **request** method.

```ecmascript 6

import { EvodoveClient, EPublishType } from 'evodove';

const publisher = new EvodoveClient({
  host: 'localhost',
  port: 45678,
  secureKey: 'mySecureKey',
  reconnectInterval: 1000,
  doReconnectOnClose: true,
  requestTimeout: 10000
});
await publisher.connect();

// This is a direct publishing
await publisher.publish('foo', { type: 'direct' }, { type: EPublishType.DIRECT });


// And this is broadcasting
await publisher.publish('foo', { type: 'broadcast' }, { type: EPublishType.BROADCAST });

// And this is an example of publishing to non-existent channel
await publisher.publish('foo', { type: 'broadcast' }, {
  type: EPublishType.DIRECT,
  waitSubscribers: true,
  ttl: 10000
});

```

###### 5. Requesting

In case when you need to get some response from another application (subscriber) you may to use request method.
Note, that requesting is always direct interaction between publisher and one of subscribers through broker, and unlike publishing you can not wait
till the subscriber will be available. At the subscriber side you can use the same handler that just returns something.
There is an example of requesting.

```ecmascript 6

import { EvodoveClient, EPublishType } from 'evodove';

const publisher = new EvodoveClient({
  host: 'localhost',
  port: 45678,
  secureKey: 'mySecureKey',
  reconnectInterval: 1000,
  doReconnectOnClose: true,
  requestTimeout: 10000
});
await publisher.connect();

const response = await publisher.request('foo', { foo: 'bar'  });
// do something with response

```

###### 6. Streams sharing

There is an opinion that sending files from one microservice to another one is an anti-pattern.
But there are the cases than it may be appropriate and useful. For example a big image was uploaded at the API side, and you need to get some info from its metadata - doing this potentially hard operation at the API side can increase execution time of your requests.
It would be better to move this functionality to another application that can be scaled horizontally.
You can use the next Evodove solution for this:

6.1 Subscribe on the stream at the needed microservice side:
Note, that stream at the subscriber`s side will be available only when data transferring was successfully finished.
For real time stream transferring use another solutions based on UDP protocol - it will be more stable and
You also can unsubscribe from the stream using the **offStream** method - so you also can use it for some kind of the dynamic solutions.

```ecmascript 6

  ...

  await subscriber.onStream('stream', (stream, meta) => {
      /*
      * Do something with stream and meta
      * Note that meta is only an object with useful info from publisher side
      * and is not related to stream
      *
      * stream is an instance of the Readable
      * */
    });

    // await subscriber.offStream('stream');
  ...

```

6.2 Publish stream from the publisher side:

```ecmascript 6
  /*
  * The stream variable should be an instance of the Readable
  * meta may be any object
  * */
  await publisher.stream('stream', stream, { mimeType: 'application/json' });

```
***

So, as You can see, usage of Evodove is very easy to use and can be helpful for developing distributed microservices based systems written as Node.js applications.

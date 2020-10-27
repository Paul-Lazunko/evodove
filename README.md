# evodove

Evodove is a Message Broker for Node.js applications. It provides next advantages to Your projects:
- security - clients and server interact with encrypted frames without keys sharing
- fast - message delivering takes few ms with delivering guarantee
- resistant - server/clients are resistant to crashes and loosing connection
- flexible - You can use it in any way You want

###### Install package

```shell script

npm i -s evodove

```

###### Create Server

server.js example
```ecmascript 6

import { Evodove } from 'evodove';

const evodove = new Evodove();

evodove.start();

```
Run server with environment variables:

```shell script

EVODOVE_SERVER_PORT=45678 EVODOVE_WORKERS_COUNT=10 EVODOVE_SECURE_KEY='mySecureKey' node server.js

```

You can use next environment variables:
- EVODOVE_SERVER_PORT - port that will be listened by Your Message Broker instance (default is 45678);
- EVODOVE_WORKERS_COUNT - concurrent queues count (default is 10)
- EVODOVE_STORE_RESPONSE_MS - value in ms that indicates maximum time value to store responses from subscribers when publisher that created request is currently unavailable
- EVODOVE_DATA_VOLUME - directory to store Message Broker instance state (when it will be restarted it can continue works with previously received messages)
- EVODOVE_SECURE_KEY - secret key that will be used to encrypt frames, the same should be used at each client side

You can use Docker image with evodove instance like there:
https://github.com/Paul-Lazunko/evodove-docker-example

###### Create subscriber

subscriber.js example

```ecmascript 6
import { EvodoveClient } from 'evodove';

const subscriber = new EvodoveClient({
  host: 'localhost',
  port: 45678,
  secureKey: 'mySecureKey',
  reconnectInterval: 1000,
  doReconnectOnClose: true,
  requestTimeout: 10000
});

subscriber.subscribe('foo', (data) => {
  console.log({ data });
});

subscriber.subscribe('bar', (data) => {
  return { works: true  }
});

subscriber.connect().catch(console.log);
```

###### Create publisher

publisher.js example

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

async function start() {
  await publisher.connect();
  await publisher.publish('foo', { foo: 'bar' }, { type: EPublishType.BROADCAST} );
  const response = await publisher.request('bar', { foo: 'bar'  });
  console.log({ response })
  await publisher.disconnect();
}

start().catch(console.log);

```
You can create client instance with options object that has next properties:

You can use next environment variables:
- host - the host of Your Message Broker instance;
- port - port listened by Your Message Broker instance;
- doReconnectOnClose - boolean that indicates do reconnect or don't;
- reconnectInterval - value in ms that defines interval between reconnection attempts;
- requestTimeout -  value in ms that defines maximal execution time for request from publisher side;
- secureKey - secret key, the same as at the server side;

Client has 6 methods that Your can use:

- **connect** and **disconnect** - to connect or disconnect from server;
- **subscribe** - to subscribe to some channel (takes 2 arguments: _channel_ (string) and _handler_ (function) that will be called).
Client can subscribes  to many channels and uses separated handler for it.
- **publish** - to publish some date in some channel (takes 3 arguments: _channel_ (string), _data_ (any) that will be published and _options_ object);
**Options** can has next properties: _type_ (EPublishType enum/string) - 'direct' or 'broadcast', _waitSubscriber_ (boolean) - that indicates to Message Broker to wait while one of subscribers will be connected, _ttl_ (positive integer) - ms value during that Message Broker will be waiting for subscribers to deliver message.
- **request** - to make request and get response from subscriber side (takes 2 arguments: _channel_ and _data_) 

So, as You can see, usage of this solution is very simple and can be helpful for developing microservices based systems written with Node.js

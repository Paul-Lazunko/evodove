import { createServer, Server, Socket } from 'net';
import { config } from '../config';
import { EMessageStatus, ERequestType } from '../constants';
import { CryptoHelper, randomString } from '../helpers';
import { IServerOptions } from '../options';
import { IMessage } from '../structures';

export class EvodoveServer {
  private server: Server;
  private readonly port: number;
  private sockets: Map <string, Socket>;
  private readonly requestHandler: (request: IMessage) => void;
  private readonly disconnectHandler: (id: string) => void;

  constructor(options: IServerOptions) {
    const { port, requestHandler, disconnectHandler } = options;
    this.sockets = new Map<string, Socket>();
    this.port = port;
    this.requestHandler = requestHandler;
    this.disconnectHandler = disconnectHandler;
    this.server = createServer(this.onConnection.bind(this));
    this.server.on('error', (e) => console.log);
  }

  public start() {
    this.server.listen(this.port);
  }

  public getSockets() {
    const sockets: string[] = [];
    this.sockets.forEach((socket: Socket, id: string) => {
      sockets.push(id);
    });
    return sockets;
  }

  public stop() {
    this.server.close();
  }

  onConnection(socket: Socket) {
    const id: string = randomString(27, true);
    let savedPreviousStringData = '';
    let isCorrectSecureKey: boolean = false;
    this.sockets.set(id, socket);
    socket.addListener('data', (data: string) => {
      const dataString: string = data.toString();
      const dataStringSplit: string[] = dataString.split('\n');
      for ( let i = 0; i < dataStringSplit.length; i = i + 1 ) {
        try {
          const decryptedData: string =
            savedPreviousStringData.length ?
                CryptoHelper.decrypt(config.secureKey, savedPreviousStringData + dataStringSplit[i])
              : CryptoHelper.decrypt(config.secureKey, dataStringSplit[i]);
          const message: IMessage = JSON.parse(decryptedData);
          isCorrectSecureKey = true;
          message.routing.publisherId = id;
          message.state = message.state || { status: EMessageStatus.ACCEPTED, receivedAt: new Date().getTime()};
          savedPreviousStringData = '';
          this.requestHandler(message);
        } catch(e) {
          if ( isCorrectSecureKey ) {
            savedPreviousStringData += dataStringSplit[i]
          } else {
            if ( this.sockets.has(id)) {
              this.sockets.delete(id);
            }
            socket.destroy();
          }
        }
      }
    });
    socket.on('end', () => {
     if ( this.sockets.has(id) ) {
       this.sockets.delete(id);
     }
     this.disconnectHandler(id);
    });
    socket.on('error', (e) => {
      if ( this.sockets.has(id) ) {
        this.sockets.delete(id);
      }
      socket.end();
    });
  }

  public makeResponse(message: IMessage): boolean {
    const { publisherId } = message.routing;
    const _socket: Socket = this.sockets.get(publisherId);
    if ( _socket ) {
      const _response: string = CryptoHelper.encrypt(config.secureKey, JSON.stringify(message));
      try {
        _socket.write(_response + '\n');
        return true;
      } catch (error) {
        if ( this.sockets.has(publisherId) ) {
          this.sockets.delete(publisherId);
        }
        _socket.end();
        return false;
      }
    }
    return false;
  }

  public makeRequest(sockets: string[], message: IMessage, errorCallback?: (message: IMessage) => void) {
    const request: string = CryptoHelper.encrypt(config.secureKey, JSON.stringify(message));
    sockets.forEach((socket: string) => {
      const _socket: Socket = this.sockets.get(socket);
      if ( _socket ) {
        try {
          _socket.write(request + '\n');
        } catch (error) {
          _socket.end();
          if ( errorCallback ) {
            errorCallback(message);
          }
        }
      }
    })

  }

}

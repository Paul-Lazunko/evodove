import { DEFAULT_REQUEST_ID_LENGTH } from '../../constants';
import { randomString } from '../../helpers';
import { IFMessageConstructParams } from '../../params';
import { IMessage } from '../../structures';

export class FMessage {
  static construct(params: IFMessageConstructParams): IMessage {
    let {
      routing
    } = params;
    const {
      channel,
      type,
      options,
      inputParams
    } = params;
    const id: string = randomString(DEFAULT_REQUEST_ID_LENGTH, true);
    routing = routing || {};
    routing.id = id;
    routing.channel = channel;
    const message: IMessage = {
      type,
      routing,
      inputParams: inputParams || {},
    };
    if ( options ) {
      message.options = options;
    }
    return message;
  }
}

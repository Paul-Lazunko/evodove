import { randomStringGenerator } from "../../helpers";
import { IFMessageConstructParams } from "../../params";
import { IMessage } from "../../structures";

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
    const id: string = randomStringGenerator(32, true);
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

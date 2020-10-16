export class ErrorFactory {

  protected static construct(message: string) {
    return new Error(message);
  }

  public static configurationError(message: string) {
    return ErrorFactory.construct(`Configuration Error: ${message}`);
  }

  public static requestError(message: string) {
    return ErrorFactory.construct(`Invalid structure of message: ${message}`);
  }

  public static messageTypeError(type: string) {
    return ErrorFactory.construct(`Publish Error: unsupported type '${type}'`);
  }

  public static subscriberExistenceError (channel: string) {
    return ErrorFactory.construct(`Publish Error: subscribers for channel '${channel}' don't exist`)
  }

  public static paramsError (message: string) {
    return ErrorFactory.construct(`Params Error: ${message}`)
  }

}

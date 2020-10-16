export class FError {

  protected static construct(message: string) {
    return new Error(message);
  }

  public static configurationError(message: string) {
    return FError.construct(`Configuration Error: ${message}`);
  }

  public static requestError(message: string) {
    return FError.construct(`Invalid structure of message: ${message}`);
  }

  public static messageTypeError(type: string) {
    return FError.construct(`Publish Error: unsupported type '${type}'`);
  }

  public static subscriberExistenceError (channel: string) {
    return FError.construct(`Publish Error: subscribers for channel '${channel}' don't exist`)
  }

  public static paramsError (message: string) {
    return FError.construct(`Params Error: ${message}`)
  }

}

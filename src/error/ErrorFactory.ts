export class ErrorFactory {

  protected static construct(message: string) {
    return new Error(message);
  }

  public static configurationError(message: string) {
    return ErrorFactory.construct(`Configuration Error: ${message}`);
  }

  public static messageTypeError(type: string) {
    return ErrorFactory.construct(`Publish Error: unsupported message type '${type}'`);
  }

  public static consumersExistenceError (channel: string) {
    return ErrorFactory.construct(`Publish Error: consumers for channel '${channel}' don't exist`)
  }

}

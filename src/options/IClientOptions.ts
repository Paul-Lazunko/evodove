export interface IClientOptions {
  host: string,
  port: number,
  secureKey: string,
  doReconnectOnClose: boolean,
  reconnectInterval: number,
  requestTimeout: number
}

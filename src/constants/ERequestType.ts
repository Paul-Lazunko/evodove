export enum ERequestType {
  ACCEPT ='accepted',
  STREAM_START ='streamStart',
  STREAM_CANCEL='streamCancel',
  STREAM_END ='streamEnd',
  STREAM_CHUNK ='streamChunk',
  REQUEST ='request',
  PUBLISH ='publish',
  RESPONSE = 'response',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  LISTEN = 'listen',
  DONT_LISTEN = 'dontListen',
  SETUP = 'setup'
}

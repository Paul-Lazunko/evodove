export interface IStreamOptions {
  onWrite?: (chunk: any) => any,
  onEnd?: () => any
}

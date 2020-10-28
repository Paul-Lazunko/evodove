export interface IRestorableStream<T> {
  restore: (index: number) => T
}

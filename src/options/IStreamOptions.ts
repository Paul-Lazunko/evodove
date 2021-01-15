import { INumberedChunk } from '../structures';

export interface IStreamOptions {
  onWrite?: (numberedChunk: INumberedChunk) => any,
  onEnd?: () => any,
  onCancel?: () => any
}

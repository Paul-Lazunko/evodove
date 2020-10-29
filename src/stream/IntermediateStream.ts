import stream from 'stream';
import { IStreamOptions } from '../options';
import { INumberedChunk } from '../structures';

export class IntermediateStream extends stream.Duplex {

  private readonly options: IStreamOptions;

  constructor(options: IStreamOptions) {
    super();
    this.options = options;
  }

  _write(chunk: INumberedChunk, enc: string, next: (...args: any[]) => any ) {
    if ( Object.hasOwnProperty.call(this.options, 'onWrite') ) {
      this.options.onWrite(chunk);
    }
    next();
  }

  end() {
    if ( Object.hasOwnProperty.call(this.options, 'onEnd') ) {
      this.options.onEnd();
    }
  }

}

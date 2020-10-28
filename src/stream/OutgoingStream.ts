import stream from 'stream';
import { IStreamOptions } from '../options';

export class OutgoingStream extends stream.Writable {
  private readonly options: IStreamOptions;

  constructor(options: IStreamOptions) {
    super();
    this.options = options;
  }

  _write(chunk: Buffer|string, enc: string, next: () => any ) {
    if ( Object.hasOwnProperty.call(this.options, 'onWrite') ) {
      this.options.onWrite(chunk);
    }
    next();
  }

  end() {
    this.options.onEnd();
  }
}

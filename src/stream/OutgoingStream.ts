import stream from 'stream';
import { IStreamOptions } from '../options';

export class OutgoingStream extends stream.Writable {
  private readonly options: IStreamOptions;
  private chunkIndex: number;

  constructor(options: IStreamOptions) {
    super();
    this.options = options;
    this.chunkIndex = 0;
  }

  _write(chunk: Buffer|string, enc: string, next: () => any ) {
    if ( Object.hasOwnProperty.call(this.options, 'onWrite') ) {
      this.options.onWrite({ chunk: chunk.toString(), index: this.chunkIndex });
      this.chunkIndex = this.chunkIndex + 1;
    }
    next();
  }

  end() {
    if ( Object.hasOwnProperty.call(this.options, 'onEnd') ) {
      this.options.onEnd();
    }
  }

  cancel() {
    if ( Object.hasOwnProperty.call(this.options, 'onCancel') ) {
      this.options.onCancel();
    }
  }
}

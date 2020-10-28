import stream from 'stream';
import { IStreamOptions } from '../options';
import { IRestorableStream } from "../structures";
import { makeGenerator } from "../helpers";

export class IntermediateStream extends stream.Duplex implements IRestorableStream<IntermediateStream> {

  private chunks: any[];
  private restoredChunks: IterableIterator<any>;
  private readonly options: IStreamOptions;

  constructor(options: IStreamOptions) {
    super();
    this.options = options;
    this.chunks = [];
    this.restoredChunks = makeGenerator([]);
  }

  _write(chunk: Buffer|string, enc: string, next: (...args: any[]) => any ) {
    this.chunks.push(chunk);
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

  _read() {
    this.push(this.restoredChunks.next().value || null);
  }

  restore(lastChunkIndex: number) {
    this.restoredChunks = makeGenerator(this.chunks.slice(lastChunkIndex + 1, this.chunks.length - 1));
    return this;
  }
}

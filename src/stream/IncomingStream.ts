import stream from 'stream';
import { IStreamOptions } from '../options';
import { INumberedChunk, IRestorableStream } from '../structures';
import { makeGenerator } from '../helpers';

export class IncomingStream extends stream.Duplex implements IRestorableStream<IncomingStream> {

  private chunks: INumberedChunk[];
  private restoredChunks: IterableIterator<any>;
  private readonly options: IStreamOptions;

  constructor(options: IStreamOptions) {
    super();
    this.options = options;
    this.chunks = [];
    this.restoredChunks = makeGenerator([]);
  }

  _write(data: Buffer, enc: string, next: (...args: any[]) => any ) {
    const chunk = JSON.parse(data.toString());
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

  protected compareNumberedChunks(a: INumberedChunk, b: INumberedChunk) {
    return Math.sign(b.index - a.index);
  }

  restore() {
    const chunks: string [] = this.chunks.sort(this.compareNumberedChunks).map((item: INumberedChunk) => item.chunk.toString());
    this.restoredChunks = makeGenerator(chunks);
    return this;
  }
}

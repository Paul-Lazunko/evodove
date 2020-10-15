import * as joi from 'joi';
import { ErrorFactory } from '../error';
import { IServerOptions } from '../options';
import { IErrorFactory } from '../structures';
import { serverOptionsValidationSchema } from './schemas';

export class Validator {

  protected static validate(schema: joi.ObjectSchema, data: any, error: string) {
    const validationResult: any = schema.validate(data, { allowUnknown: false, convert: true });
    if ( validationResult && validationResult.error ) {
      // @ts-ignore
      throw ErrorFactory[error](validationResult.error.message)
    }
  }

  public static validateServerOptions(serverOptions: IServerOptions) {
    return Validator.validate(serverOptionsValidationSchema, serverOptions, 'configurationError')
  }
}

import * as joi from 'joi';
import { FError } from '../error';
import { IClientOptions, IServerOptions } from '../options';
import { IErrorFactory, IMessage } from '../structures';
import {
  channel,
  handler,
  inputParams,
  messageOptions,
  clientOptionsValidationSchema,
  messageValidationSchema,
  serverOptionsValidationSchema
} from './schemas';

export class Validator {

  protected static validate(schema: joi.ObjectSchema, data: any, error: string) {
    const validationResult: any = schema.validate(data, { allowUnknown: false, convert: true });
    if ( validationResult && validationResult.error ) {
      // @ts-ignore
      throw FError[error](validationResult.error.message)
    }
  }

  public static validateServerOptions(serverOptions: IServerOptions) {
    return Validator.validate(serverOptionsValidationSchema, serverOptions, 'configurationError')
  }

  public static validateClientOptions(clientOptions: IClientOptions) {
    return Validator.validate(clientOptionsValidationSchema, clientOptions, 'configurationError')
  }

  public static validateMessage(message: IMessage) {
    return Validator.validate(messageValidationSchema, message, 'requestError')
  }

  public static validateChannel(value: any) {
    return Validator.validate(channel, value, 'paramsError')
  }

  public static validateHandler(value: any) {
    return Validator.validate(handler, value, 'paramsError')
  }

  public static validateInputParams(value: any) {
    return Validator.validate(inputParams, value, 'paramsError')
  }

  public static validateMessageOptions(value: any) {
    return Validator.validate(messageOptions, value, 'paramsError')
  }

}

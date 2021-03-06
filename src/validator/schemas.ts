import { DEFAULT_REQUEST_ID_LENGTH, EPublishType, ERequestType } from '../constants';

const joi = require('joi');

const channel = joi.string().required();
const inputParams = joi.any();
const messageOptions = joi.object({
  type: joi.string().valid(...Object.values(EPublishType)),
  ttl: joi.number().positive().integer().min(1000),
  waitSubscribers: joi.boolean()
});
const handler = joi.function().required();

const serverOptionsValidationSchema = joi.object({
  port: joi.number().positive().integer().min(1025).max(65535),
  workersCount: joi.number().positive().integer().min(1),
  storeRequestValueMs: joi.number().positive().integer().min(1000),
  dataVolume: joi.string(),
  dataFileName: joi.string(),
  secureKey: joi.string().required()
});

const clientOptionsValidationSchema = joi.object({
  port: joi.number().positive().integer().min(1025).max(65535).required(),
  host: joi.string().required(),
  secureKey: joi.string().required(),
  reconnectInterval: joi.number().positive().integer(),
  requestTimeout: joi.number().positive().integer(),
  doReconnectOnClose: joi.boolean(),

});


const messageValidationSchema = joi.object({
  type: joi.string().valid(...Object.values(ERequestType)).required(),
  routing: joi.object({
    id: joi.string().length(DEFAULT_REQUEST_ID_LENGTH).required(),
    streamId: joi.string().length(DEFAULT_REQUEST_ID_LENGTH),
    channel: joi.string(),
    publisherId: joi.string(),
    subscriberId: joi.string(),
    previousPublisherId: joi.string()
  }).required(),
  inputParams: joi.any(),
  outputParams: joi.any(),
  state: joi.any(),
  options: messageOptions
});

export {
  serverOptionsValidationSchema,
  clientOptionsValidationSchema,
  messageValidationSchema,
  channel,
  handler,
  messageOptions,
  inputParams
};

const joi = require('joi');

const serverOptionsValidationSchema = joi.object({
  port: joi.number().positive().integer().min(1025).max(65535),
  workersCount: joi.number().positive().integer().min(1),
  storeRequestValueMs: joi.number().positive().integer().min(1000),
  secretKey: joi.string().required()
});


export {
  serverOptionsValidationSchema,
};

import { resolve } from 'path';
import { config } from '../config';

const store = require('data-store')({ path: resolve(__dirname,  `${config.dataVolume}/${config.dataFileName}`) });

export { store }

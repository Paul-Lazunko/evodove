import {
  DEFAULT_EVODOVE_SERVER_PORT,
  DEFAULT_EVODOVE_WORKERS_COUNT,
  DEFAULT_EVODOVE_STORE_RESPONSE_MS,
  DEFAULT_EVODOVE_DATA_FILENAME,
  DEFAULT_EVODOVE_DATA_VOLUME
} from '../constants';

const data: { [key: string]: string | number } = process.env;

for ( const variable in data ) {
  try {
    if ( /^\d+$/.test( data[variable].toString() ) ) {
      data[variable] = parseInt(data[variable].toString(), 10);
    }
  } catch(e) {}
}

export const config: any = {
  port: process.env.EVODOVE_SERVER_PORT || DEFAULT_EVODOVE_SERVER_PORT,
  workersCount: process.env.EVODOVE_WORKERS_COUNT || DEFAULT_EVODOVE_WORKERS_COUNT,
  storeRequestValueMs: process.env.EVODOVE_STORE_RESPONSE_MS || DEFAULT_EVODOVE_STORE_RESPONSE_MS,
  dataVolume: process.env.EVODOVE_DATA_VOLUME || DEFAULT_EVODOVE_DATA_VOLUME,
  dataFileName: DEFAULT_EVODOVE_DATA_FILENAME,
  secureKey: process.env.EVODOVE_SECURE_KEY
};

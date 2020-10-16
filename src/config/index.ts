import {
  DEFAULT_NO_BRO_SERVER_PORT,
  DEFAULT_NO_BRO_WORKERS_COUNT,
  DEFAULT_NO_BRO_STORE_RESPONSE_MS,
  DEFAULT_NO_BRO_DATA_FILENAME,
  DEFAULT_NO_BRO_DATA_VOLUME
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
  port: process.env.NO_BRO_SERVER_PORT || DEFAULT_NO_BRO_SERVER_PORT,
  workersCount: process.env.NO_BRO_WORKERS_COUNT || DEFAULT_NO_BRO_WORKERS_COUNT,
  storeRequestValueMs: process.env.NO_BRO_STORE_RESPONSE_MS || DEFAULT_NO_BRO_STORE_RESPONSE_MS,
  dataVolume: process.env.NO_BRO_DATA_VOLUME || DEFAULT_NO_BRO_DATA_VOLUME,
  dataFileName: DEFAULT_NO_BRO_DATA_FILENAME,
  secureKey: process.env.NO_BRO_SECRET_KEY
};

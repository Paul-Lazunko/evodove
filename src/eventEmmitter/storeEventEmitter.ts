import { EventEmitter } from 'events';
import {
  STORE_EE_EVENT_NAME,
  STORE_EE_EVENT_TIMER,
  STORE_ROOT_KEY
} from '../constants';
import { store } from '../store';

const handlers: Map<string, () => void> = new Map<string, () => void>();

const addStoreHandler = (key: string, handler: () => void) => {
  handlers.set(key, handler);
};

const removeStoreHandler = (key: string) => {
  handlers.delete(key);
};

const storeEventEmitter: EventEmitter = new EventEmitter();

storeEventEmitter.on(STORE_EE_EVENT_NAME, () => {
  if ( !store.get(STORE_ROOT_KEY) ) {
    store.set(STORE_ROOT_KEY, {});
  }
  handlers.forEach((handler: () => void, key: string) => {
    store.set(`${STORE_ROOT_KEY}.${key}`, handler());
  });
  setTimeout(() => {
    storeEventEmitter.emit(STORE_EE_EVENT_NAME)
  }, STORE_EE_EVENT_TIMER)
});

storeEventEmitter.emit(STORE_EE_EVENT_NAME);

export { addStoreHandler, removeStoreHandler }

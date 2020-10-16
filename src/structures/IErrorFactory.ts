import { FError } from '../error';

export interface IErrorFactory extends Pick<FError, keyof FError> {

}

import { dispatchWindowEvent } from '../../shared/lib/dispatchWindowEvent';
export const requestNewSession = () => {
  dispatchWindowEvent({ name: 'goodboy:new-session' });
};

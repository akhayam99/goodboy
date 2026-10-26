import { dispatchWindowEvent } from '../../shared/lib/dispatchWindowEvent';
export const openNewWorkspace = (): void => {
  dispatchWindowEvent({ name: 'goodboy:add-workspace' });
};

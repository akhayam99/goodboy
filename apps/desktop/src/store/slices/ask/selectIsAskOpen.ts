import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { AskState } from './state';

type Params = {
  readonly state: Pick<AppState, 'appStudio'> & Pick<AskState, 'askPaneOpen'>;
  readonly sessionId: SessionId;
};

export const selectIsAskOpen = ({ state, sessionId }: Params): boolean =>
  state.askPaneOpen[sessionId] === true && state.appStudio === null;

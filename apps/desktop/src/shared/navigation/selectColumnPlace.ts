import type { AppState } from '../../store/types';
import { selectIsSessionDraftShown } from '../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { columnPlaceOf, type ColumnPlace } from './columnPlace';

type Params = {
  readonly state: Pick<
    AppState,
    'appStudio' | 'currentSessionId' | 'currentWorkspaceId' | 'openSessionDraftWorkspaceId'
  >;
};

export const selectColumnPlace = ({ state }: Params): ColumnPlace =>
  columnPlaceOf({
    hasSession: state.currentSessionId !== null,
    isDraftShown: selectIsSessionDraftShown({ state }),
    studio: state.appStudio?.kind ?? null,
  });

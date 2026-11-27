import type { AppState } from '../../store/types';
import { selectIsSessionDraftShown } from '../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { selectIsHomeShown } from './selectIsHomeShown';
import { columnPlaceOf, type ColumnPlace } from './columnPlace';

type Params = {
  readonly state: Pick<
    AppState,
    | 'appStudio'
    | 'currentSessionId'
    | 'currentWorkspaceId'
    | 'openSessionDraftWorkspaceId'
    | 'openHomeWorkspaceId'
  >;
};

export const selectColumnPlace = ({ state }: Params): ColumnPlace =>
  columnPlaceOf({
    hasSession: state.currentSessionId !== null,
    isDraftShown: selectIsSessionDraftShown({ state }),
    isHomeShown: selectIsHomeShown({ state }),
    studio: state.appStudio?.kind ?? null,
  });

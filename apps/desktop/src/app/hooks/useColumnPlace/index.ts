import { useAppStore } from '../../../store';
import { selectIsSessionDraftShown } from '../../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { columnPlaceOf, type ColumnPlace } from '../../components/SideColumn/columnPlace';

export const useColumnPlace = (): ColumnPlace =>
  useAppStore((state) =>
    columnPlaceOf({
      hasSession: state.currentSessionId !== null,
      isDraftShown: selectIsSessionDraftShown({ state }),
      studio: state.appStudio?.kind ?? null,
    }),
  );

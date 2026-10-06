import type { StudioKind } from '../../../store';

export type ColumnDoorId = 'board' | 'inbox' | 'chat' | 'workflows';

export type ColumnPlace = ColumnDoorId | 'new' | 'settings' | 'impact' | null;

type Params = {
  readonly hasSession: boolean;
  readonly isDraftShown: boolean;
  readonly studio: StudioKind | null;
};

const studioPlace = ({ studio }: { readonly studio: StudioKind }): ColumnPlace => {
  switch (studio) {
    case 'inbox':
      return 'inbox';
    case 'chat':
      return 'chat';
    case 'workflow':
      return 'workflows';
    case 'settings':
      return 'settings';
    case 'impact':
      return 'impact';
    case 'guide':
    case 'companion':
    case 'addWorkspace':
    case 'changelog':
    case 'notifications':
      return null;
    default: {
      const unreachable: never = studio;
      return unreachable;
    }
  }
};

export const columnPlaceOf = ({ hasSession, isDraftShown, studio }: Params): ColumnPlace => {
  if (studio !== null) {
    return studioPlace({ studio });
  }
  if (isDraftShown) {
    return 'new';
  }
  return hasSession ? null : 'board';
};

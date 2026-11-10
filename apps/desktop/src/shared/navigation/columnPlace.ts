import type { StudioKind } from '../../store';
import type { DestinationId, FootDestinationId, RailDestinationId } from './destinations';

export type ColumnDoorId = Exclude<
  DestinationId,
  'notifications' | FootDestinationId | RailDestinationId
>;

export type ColumnPlace =
  | ColumnDoorId
  | RailDestinationId
  | 'new'
  | 'settings'
  | 'help'
  | 'notifications'
  | 'addWorkspace'
  | null;

type Params = {
  readonly hasSession: boolean;
  readonly isDraftShown: boolean;
  readonly studio: StudioKind | null;
};

type StudioParams = {
  readonly studio: StudioKind;
};

const studioPlace = ({ studio }: StudioParams): ColumnPlace => {
  switch (studio) {
    case 'inbox':
      return 'inbox';
    case 'chat':
      return 'chat';
    case 'workflow':
      return 'workflows';
    case 'terminal':
      return 'terminal';
    case 'browser':
      return 'browser';
    case 'monitoring':
      return 'monitoring';
    case 'settings':
      return 'settings';
    case 'impact':
      return 'impact';
    case 'guide':
    case 'changelog':
      return 'help';
    case 'notifications':
      return 'notifications';
    case 'addWorkspace':
      return 'addWorkspace';
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

const STUDIO_OVER_SESSION: ReadonlySet<ColumnPlace> = new Set<ColumnPlace>([
  'inbox',
  'chat',
  'workflows',
  'terminal',
  'browser',
  'monitoring',
  'impact',
  'help',
  'notifications',
  'addWorkspace',
]);

type StudioOverSessionParams = {
  readonly place: ColumnPlace;
};

export const isStudioOverSession = ({ place }: StudioOverSessionParams): boolean =>
  STUDIO_OVER_SESSION.has(place);

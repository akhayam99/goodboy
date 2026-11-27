import type { StudioKind } from '../../store';
import type { DestinationId, FootDestinationId, RailDestinationId } from './destinations';
import { studioPlaceOf } from './studioPlaceOf';

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

export const columnPlaceOf = ({ hasSession, isDraftShown, studio }: Params): ColumnPlace => {
  if (studio !== null) {
    return studioPlaceOf({ studio });
  }
  if (isDraftShown) {
    return 'new';
  }
  return hasSession ? null : 'board';
};

const STUDIO_OVER_SESSION: ReadonlySet<ColumnPlace> = new Set<ColumnPlace>([
  'inbox',
  'chat',
  'calendar',
  'connections',
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

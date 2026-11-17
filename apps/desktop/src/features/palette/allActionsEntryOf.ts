import { List } from '@goodboy/ui/icons';
import type { SessionId } from '@goodboy/types';
import type { PaletteEntry } from './types';

const ALL_ACTIONS_KEY = 'level:session-actions';

type Params = {
  readonly sessionId: SessionId;
};

export const allActionsEntryOf = ({ sessionId }: Params): PaletteEntry => ({
  key: ALL_ACTIONS_KEY,
  label: 'All actions for this session',
  kind: 'level',
  group: null,
  icon: List,
  level: { kind: 'actions', target: { kind: 'session', sessionId } },
  run: () => undefined,
});

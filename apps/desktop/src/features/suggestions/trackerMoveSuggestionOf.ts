import type { SessionId } from '@goodboy/types';
import type { TrackerMove } from '../../store/slices/tracker-moves/types';
import type { SessionSuggestion } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly move: TrackerMove;
};

const TOOL_LABEL = { linear: 'Linear', jira: 'Jira' } as const;

export const trackerMoveSuggestionOf = ({ sessionId, move }: Params): SessionSuggestion => ({
  id: `move-tracker-item:${move.key}`,
  kind: 'move-tracker-item',
  priority: 50,
  band: 3,
  title: `Move ${move.identifier} to ${move.toName}`,
  detail: `Now ${move.fromName} in ${TOOL_LABEL[move.provider]}`,
  sessionId,
  targetKey: `tracker:${move.key}`,
  fingerprint: `move-tracker-item:${move.key}:${move.fromName}:${move.toName}`,
  payload: { move },
});

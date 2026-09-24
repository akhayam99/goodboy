import { Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type {
  MountPresenceAgent,
  MountPresenceState,
} from '../../../../../store/slices/project-mounts/selectMountPresence';
import { TimelineMarker } from '../../SessionWorkspace/parts/TimelinePane/TimelineMarker';

type Props = {
  readonly sessionId: SessionId;
  readonly label: string;
  readonly agents: ReadonlyArray<MountPresenceAgent>;
};

const VISIBLE_NODES = 3;

const STATE_PHRASE: Record<MountPresenceState, string> = {
  running: 'is working',
  needsUser: 'needs you',
  question: 'is waiting on your answer',
};

type CountLabelParams = {
  readonly count: number;
};

const countLabel = ({ count }: CountLabelParams): string =>
  count === 1 ? '1 agent here' : `${count} agents here`;

export const MountPresence = ({ sessionId, label, agents }: Props) => {
  const selectAgent = useAppStore((state) => state.selectAgent);
  if (agents.length === 0) {
    return null;
  }
  const visible = agents.slice(0, VISIBLE_NODES);
  const hidden = agents.length - visible.length;
  return (
    <span
      data-testid="mount-presence"
      role="group"
      aria-label={`Agents working in ${label}`}
      className="inline-flex shrink-0 items-center gap-1"
    >
      <span className="inline-flex items-center gap-0.5">
        {visible.map((agent) => {
          const sentence = `${agent.name} ${STATE_PHRASE[agent.state]} in ${label}`;
          return (
            <Tooltip key={agent.agentId} content={sentence}>
              <button
                type="button"
                aria-label={`Open ${agent.name}`}
                onClick={() => void selectAgent(sessionId, agent.agentId)}
                className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <TimelineMarker state={agent.state} grade="step" />
              </button>
            </Tooltip>
          );
        })}
      </span>
      {hidden > 0 && (
        <span className="text-3xs tabular-nums text-muted-foreground">{`+${hidden}`}</span>
      )}
      <span className="truncate text-3xs tabular-nums text-faint-foreground">
        {countLabel({ count: agents.length })}
      </span>
    </span>
  );
};

import { StatusDot, type Tone } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import type { RowPhase } from '../../../workTreeModel/rowState';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { AGENT_KIND_META } from '../../agent-kind';
import type { LiveChild } from './liveGroupsOf';

type Props = {
  readonly child: LiveChild;
};

const PHASE_TONE: Record<RowPhase, Tone> = {
  queued: 'neutral',
  running: 'info',
  waiting: 'warning',
  failed: 'danger',
  done: 'success',
  closed: 'neutral',
  skipped: 'neutral',
};

export const LiveChildLine = ({ child }: Props) => (
  <li data-live-child={child.phase} className="flex min-w-0 items-center gap-2 pl-6">
    <StatusDot tone={PHASE_TONE[child.phase]} size="sm" />
    <AgentKindChip kind={child.agentKind} density="glyph" isDecorative />
    <span className="shrink-0 text-label text-foreground">
      {AGENT_KIND_META[child.agentKind].noun}
    </span>
    <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">{child.title}</span>
    <DelegationClock agentId={child.agentId} isLive={child.phase === 'running'} />
  </li>
);

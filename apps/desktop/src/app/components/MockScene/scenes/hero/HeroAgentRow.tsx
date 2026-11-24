import { WorkNode, cn, tintClasses, type Tone, type WorkNodeState } from '@goodboy/ui';
import { agentKindPalette } from '../../../../../features/session/agent-kind';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../../../shared/components/RoutingLabel';
import type { HeroAgentSpec } from './heroSeed';

type RowLook = Readonly<{
  word: string;
  node: WorkNodeState;
  tone: Tone;
}>;

const LOOK_BY_STATUS: Readonly<Record<string, RowLook>> = {
  running: { word: 'Working', node: 'running', tone: 'info' },
  pending: { word: 'Queued', node: 'queued', tone: 'neutral' },
  completed: { word: 'Done', node: 'done', tone: 'neutral' },
};

const DONE_LOOK: RowLook = { word: 'Done', node: 'done', tone: 'neutral' };

type Props = {
  readonly spec: HeroAgentSpec;
};

export const HeroAgentRow = ({ spec }: Props) => {
  const look = LOOK_BY_STATUS[spec.status] ?? DONE_LOOK;
  return (
    <li
      data-hero-agent={spec.key}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-elevated px-3 py-3 text-meta"
    >
      <span className="flex min-w-0 items-center gap-2">
        <WorkNode
          state={look.node}
          mark={{ kind: 'dot' }}
          label={look.word}
          size="sm"
          isSpinning={spec.status === 'running'}
        />
        <AgentKindChip kind={spec.kind} density="glyph" isDecorative />
        <span className="shrink-0 text-muted-foreground">
          {agentKindPalette({ kind: spec.kind }).label}
        </span>
        <span className="min-w-0 flex-1 truncate text-foreground">{spec.name}</span>
        <span className={cn('shrink-0', tintClasses(look.tone).text)}>{look.word}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1 pl-12">
        <RoutingLabel provider={spec.provider} model={spec.model} effort={spec.effort} />
        <span className="min-w-0 truncate text-muted-foreground">{spec.why}</span>
      </span>
    </li>
  );
};

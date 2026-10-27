import { EmptyLine } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../../../shared/components/AgentKindChip';
import { NAMES } from '../../../../../../../shared/utils/names';
import type { AgentKind } from '../../../../../agent-kind';

const GHOST_STEPS = ['scout', 'planner', 'implementer'] as const satisfies ReadonlyArray<
  AgentKind & keyof typeof NAMES.role
>;

export const TimelineGhostRun = () => (
  <div data-slot="ghost-run" className="flex flex-col gap-2 px-3 pt-3">
    <ol aria-label="Steps a run takes" className="flex flex-col gap-2">
      {GHOST_STEPS.map((kind) => (
        <li key={kind} className="flex h-6 items-center gap-2 text-meta text-faint-foreground">
          <AgentKindChip
            kind={kind}
            density="glyph"
            isDecorative
            className="text-faint-foreground"
          />
          <span>{NAMES.role[kind]}</span>
          <span>Queued</span>
        </li>
      ))}
    </ol>
    <EmptyLine>No model is chosen until a run starts</EmptyLine>
  </div>
);

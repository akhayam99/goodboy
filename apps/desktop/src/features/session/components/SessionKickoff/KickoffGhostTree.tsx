import { WorkNode } from '@goodboy/ui';
import type { AgentKind } from '../../agent-kind';
import { AgentKindChip } from '../AgentKindChip';
import { GlossaryTerm } from '../GlossaryTerm';

type GhostRow = {
  readonly index: string;
  readonly kind: AgentKind;
  readonly detail: string;
};

const GHOST_ROWS: ReadonlyArray<GhostRow> = [
  { index: '3', kind: 'implementer', detail: 'Makes the change' },
  { index: '2', kind: 'planner', detail: 'Writes a plan you approve' },
  { index: '1', kind: 'scout', detail: 'Reads the code first' },
];

export const KickoffGhostTree = () => (
  <div className="flex flex-col gap-2 px-0.5">
    <ol aria-label="Example run" className="relative flex flex-col opacity-60">
      <span
        aria-hidden
        className="absolute inset-y-3.5 left-2.5 -translate-x-1/2 border-l-2 border-dashed border-border-soft"
      />
      {GHOST_ROWS.map((row) => (
        <li key={row.index} className="relative flex h-7 min-w-0 items-center gap-2">
          <WorkNode
            state="queued"
            mark={{ kind: 'index', value: row.index }}
            label={`Step ${row.index}`}
          />
          <AgentKindChip kind={row.kind} />
          <span className="min-w-0 truncate text-xs text-muted-foreground">{row.detail}</span>
        </li>
      ))}
    </ol>
    <div className="text-2xs text-faint-foreground">
      A <GlossaryTerm term="workflow">workflow</GlossaryTerm> runs agents like these in order. The
      plans and reports they write are <GlossaryTerm term="artifact">artifacts</GlossaryTerm>.
    </div>
  </div>
);

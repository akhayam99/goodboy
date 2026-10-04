import { Eyebrow } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import type { PlanPartRow as Row } from './planPartRows';
import { PlanPartRow } from './PlanPartRow';

type Props = {
  readonly sessionId: SessionId;
  readonly planId: ArtifactId;
  readonly rows: ReadonlyArray<Row>;
  readonly hasRun: boolean;
  readonly splitSentence: string;
  readonly onOpenPart: (row: Row) => void;
};

export const PlanParts = ({
  sessionId,
  planId,
  rows,
  hasRun,
  splitSentence,
  onOpenPart,
}: Props) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <section aria-label="Parts" data-testid="plan-parts" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <h2>
          <Eyebrow label="Parts" />
        </h2>
        <span className="text-meta tabular-nums text-faint-foreground">{rows.length}</span>
      </div>
      {hasRun ? null : <p className="text-label text-muted-foreground">{splitSentence}</p>}
      <ol className="flex min-w-0 flex-col">
        {rows.map((row) => (
          <li key={row.index} className="min-w-0">
            <PlanPartRow
              row={row}
              hasRun={hasRun}
              onOpen={() => onOpenPart(row)}
              target={{
                kind: 'planPart',
                sessionId,
                planId,
                index: row.index,
                instructions: row.instructions,
                agentId: row.agentId,
              }}
            />
          </li>
        ))}
      </ol>
    </section>
  );
};

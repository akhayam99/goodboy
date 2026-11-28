import { useState } from 'react';
import { Button, SectionLabel, SelectableRow, StatusDot, TruncatedText } from '@goodboy/ui';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../../store';
import { useNow } from '../../../../../shared/hooks/useNow';
import { joinFacts } from '../../../../../shared/utils/joinFacts';
import { NAMES } from '../../../../../shared/utils/names';
import { elapsedWordOf } from '../../../central/board/boardRowWordsOf';
import type { NowModel } from '../../../central/now/nowRowsOf';
import { STAGE_TONE } from '../../../session-stage';

type Props = {
  readonly sessionId: SessionId;
  readonly model: NowModel;
};

const CLOCK_MS = 15_000;

export const NowSection = ({ sessionId, model }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const [isAll, setIsAll] = useState(false);
  const now = useNow(CLOCK_MS, model.rows.length > 0 || model.waits.length > 0);
  if (model.rows.length === 0 && model.waits.length === 0) {
    return null;
  }
  const rows = isAll ? model.rows : model.shown;
  return (
    <section
      aria-label={NAMES.nowSection}
      data-overview-section="now"
      className="flex min-w-0 flex-col gap-1"
    >
      <span className="flex h-7 items-center">
        <SectionLabel label={NAMES.nowSection} headingLevel={2} />
      </span>
      {rows.map((row) => (
        <SelectableRow
          key={row.agentId}
          selected={false}
          testId={`now-row-${row.agentId}`}
          onClick={() => {
            const agentId = brandId<AgentId>({ value: row.agentId });
            navigate({ to: agentPlace({ sessionId, agentId }) });
          }}
          className="min-h-8 min-w-0 items-center gap-2 px-2"
        >
          {row.depth === 1 ? <span aria-hidden className="w-4 shrink-0" /> : null}
          <StatusDot tone={STAGE_TONE.running} size="sm" pulsing />
          <span className="shrink-0 text-ui text-foreground">{row.who}</span>
          <TruncatedText className="min-w-0 flex-1 text-ui text-muted-foreground">
            {joinFacts({ facts: [row.place !== null && row.place, row.phrase] })}
          </TruncatedText>
          {row.startedAt === null ? null : (
            <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
              {elapsedWordOf({ elapsedMs: Math.max(0, now - row.startedAt) })}
            </span>
          )}
        </SelectableRow>
      ))}
      {model.moreCount > 0 ? (
        <span className="flex px-2">
          <Button size="sm" variant="quiet" onClick={() => setIsAll((wasAll) => !wasAll)}>
            {isAll ? 'Show fewer' : `${model.moreCount} more`}
          </Button>
        </span>
      ) : null}
      {model.waits.map((wait) => (
        <span
          key={wait.id}
          data-now-wait={wait.isHot ? 'hot' : 'quiet'}
          className="flex min-h-7 min-w-0 items-center gap-2 px-2 text-meta text-muted-foreground"
        >
          {wait.isHot ? <StatusDot tone={STAGE_TONE.attention} size="sm" /> : null}
          <TruncatedText className="min-w-0 flex-1">{wait.text}</TruncatedText>
          {wait.since === null ? null : (
            <span className="shrink-0 tabular-nums text-faint-foreground">
              {elapsedWordOf({ elapsedMs: Math.max(0, now - wait.since) })}
            </span>
          )}
        </span>
      ))}
    </section>
  );
};

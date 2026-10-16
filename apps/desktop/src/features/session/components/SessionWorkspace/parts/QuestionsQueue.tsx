import type { Agent, AgentId, OpenQuestionId } from '@goodboy/types';
import { Eyebrow, ScrollFade } from '@goodboy/ui';
import { NAMES } from '../../../../../shared/names';
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { classifyAgent, type AgentKind } from '../../../agent-kind';
import { QuestionQueueRow } from './QuestionQueueRow';
import type { QuestionRow, QuestionsLensModel } from './questionsLensModel';
import { useNow } from '../../../../../shared/hooks/useNow';

type Props = {
  readonly model: QuestionsLensModel;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverrides: Readonly<Record<AgentId, AgentKind>>;
  readonly selectedId: OpenQuestionId | null;
  readonly onSelect: (id: OpenQuestionId) => void;
  readonly onUndo: (row: QuestionRow) => void;
};

export const QuestionsQueue = ({
  model,
  agents,
  kindOverrides,
  selectedId,
  onSelect,
  onUndo,
}: Props) => {
  const now = useNow(30_000);
  const renderRow = (row: QuestionRow) => {
    const askerId = row.question.createdByAgentId ?? null;
    const asker = askerId === null ? null : (agents.find((agent) => agent.id === askerId) ?? null);
    return (
      <QuestionQueueRow
        key={row.question.id}
        row={row}
        isSelected={row.question.id === selectedId}
        askerKind={
          asker === null
            ? null
            : classifyAgent({ agent: asker, override: kindOverrides[asker.id] ?? null })
        }
        age={formatAge({ from: row.question.createdAt, now })}
        onSelect={() => onSelect(row.question.id)}
        onUndo={row.kind === 'staged' || row.kind === 'dismissed' ? () => onUndo(row) : null}
      />
    );
  };
  const answered = [...model.recent, ...model.answered];
  const groups = [
    { key: 'waiting', label: NAMES.needsYou, rows: model.waiting },
    { key: 'delegated', label: 'With an agent', rows: model.delegated },
    { key: 'answered', label: 'Answered', rows: answered },
  ].filter((group) => group.rows.length > 0);
  const hasLabels = groups.length > 1;

  return (
    <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
      <section aria-label="Questions" className="flex flex-col gap-3 pb-3">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-0.5">
            {hasLabels ? (
              <span className="flex h-7 items-center gap-2 px-3">
                <Eyebrow label={group.label} />
                {group.rows.length > 1 ? (
                  <span className="text-chip tabular-nums text-faint-foreground">
                    {group.rows.length}
                  </span>
                ) : null}
              </span>
            ) : null}
            {group.rows.map(renderRow)}
          </div>
        ))}
      </section>
    </ScrollFade>
  );
};

import { ChevronRight } from 'lucide-react';
import type { Agent, AgentId, OpenQuestionId } from '@goodboy/types';
import { cn, Eyebrow, ScrollFade } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { classifyAgent, type AgentKind } from '../../../agent-kind';
import { QuestionQueueRow } from './QuestionQueueRow';
import type { QuestionRow, QuestionsLensModel } from './questionsLensModel';

type Props = {
  readonly model: QuestionsLensModel;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverrides: Readonly<Record<AgentId, AgentKind>>;
  readonly selectedId: OpenQuestionId | null;
  readonly isAnsweredOpen: boolean;
  readonly onToggleAnswered: () => void;
  readonly onSelect: (id: OpenQuestionId) => void;
  readonly onUndo: (row: QuestionRow) => void;
};

export const QuestionsQueue = ({
  model,
  agents,
  kindOverrides,
  selectedId,
  isAnsweredOpen,
  onToggleAnswered,
  onSelect,
  onUndo,
}: Props) => {
  const renderRow = (row: QuestionRow) => {
    const askerId = row.question.createdByAgentId ?? null;
    const asker = askerId === null ? null : (agents.find((agent) => agent.id === askerId) ?? null);
    return (
      <QuestionQueueRow
        key={row.question.id}
        row={row}
        isSelected={row.question.id === selectedId}
        askerName={asker?.name ?? null}
        askerKind={
          asker === null
            ? null
            : classifyAgent({ agent: asker, override: kindOverrides[asker.id] ?? null })
        }
        age={formatRelativeAge({ fromIso: row.question.createdAt }).replace(/ ago$/, '')}
        onSelect={() => onSelect(row.question.id)}
        onUndo={row.kind === 'staged' || row.kind === 'dismissed' ? () => onUndo(row) : null}
      />
    );
  };
  const answeredCount = model.answered.length + model.recent.length;

  return (
    <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
      <section aria-label="Questions" className="flex flex-col gap-1 px-2 pb-3">
        {model.waiting.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 px-2.5 pb-1 pt-2">
              <Eyebrow label="Waiting on you" />
              <span className="text-meta text-faint-foreground">{model.waiting.length}</span>
            </span>
            {model.waiting.map(renderRow)}
          </div>
        )}
        {model.delegated.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 px-2.5 pb-1 pt-2">
              <Eyebrow label="With an agent" />
              <span className="text-meta text-faint-foreground">{model.delegated.length}</span>
            </span>
            {model.delegated.map(renderRow)}
          </div>
        )}
        {answeredCount > 0 && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-expanded={isAnsweredOpen}
              onClick={onToggleAnswered}
              className="flex items-center gap-1.5 rounded-md px-2.5 pb-1 pt-2 text-faint-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <ChevronRight
                size={ICON_SIZE.row}
                aria-hidden
                className={cn('motion-safe:transition-transform', isAnsweredOpen && 'rotate-90')}
              />
              <Eyebrow label="Answered" />
              <span className="text-meta">{answeredCount}</span>
            </button>
            {model.recent.map(renderRow)}
            {isAnsweredOpen && model.answered.map(renderRow)}
          </div>
        )}
      </section>
    </ScrollFade>
  );
};

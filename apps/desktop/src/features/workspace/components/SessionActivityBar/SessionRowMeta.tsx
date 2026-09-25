import { cn, tintClasses } from '@goodboy/ui';
import { ExternalTaskChip } from '../../../integrations/components/ExternalTaskChip';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SummaryMetaItem } from '../../hooks/useSessionSummary/summaryMeta';

type Props = {
  readonly item: SummaryMetaItem;
};

type PluralParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const NARROW_HIDDEN = '@max-[280px]:hidden';

const plural = ({ count, one, many }: PluralParams) => `${count} ${count === 1 ? one : many}`;

export const SessionRowMeta = ({ item }: Props) => {
  if (item.kind === 'actionable') {
    const { kind, count } = item.actionable;
    const isQuestions = kind === 'questions';
    const Icon = isQuestions ? CONCEPT_ICONS.questions : CONCEPT_ICONS.review;
    const label = isQuestions
      ? plural({ count, one: 'question to answer', many: 'questions to answer' })
      : plural({ count, one: 'review draft', many: 'review drafts' });
    return (
      <span
        data-testid="session-row-actionable"
        className={cn(
          'inline-flex shrink-0 items-center gap-1 text-3xs font-medium tabular-nums',
          tintClasses(isQuestions ? 'warning' : 'draft').icon,
        )}
      >
        <Icon size={ICON_SIZE.row} aria-hidden />
        <span aria-hidden>{count}</span>
        <span aria-hidden className={NARROW_HIDDEN}>
          {isQuestions ? 'to answer' : count === 1 ? 'draft' : 'drafts'}
        </span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  if (item.kind === 'task') {
    return (
      <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
        <ExternalTaskChip task={item.task} variant="compact" identifierClassName={NARROW_HIDDEN} />
        {item.more > 0 ? (
          <span className="text-3xs tabular-nums text-faint-foreground">
            <span aria-hidden>+{item.more}</span>
            <span className="sr-only">
              {plural({ count: item.more, one: 'more task', many: 'more tasks' })}
            </span>
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-3xs tabular-nums text-faint-foreground">
      <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
      <span aria-hidden>{item.count}</span>
      <span className="sr-only">{plural({ count: item.count, one: 'agent', many: 'agents' })}</span>
    </span>
  );
};

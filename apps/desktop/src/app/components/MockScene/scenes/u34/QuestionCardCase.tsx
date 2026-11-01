import { QuestionCard } from '../../../../../features/context/components/QuestionsTab/QuestionCard';
import type { QuestionPagerModel } from '../../../../../features/context/components/QuestionsTab/QuestionCard/QuestionPager';
import type { QuestionDelegateControls } from '../../../../../features/context/hooks/useQuestionDelegateControls';
import type { QuestionCardCase as Case } from './questionCardStatesSeed';

const noop = () => undefined;

const DELEGATE: QuestionDelegateControls = {
  delegateState: 'available',
  delegateHints: '',
  delegateRouting: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
  connectedProviders: ['anthropic'],
  onChooseDelegate: noop,
  onCancelDelegate: noop,
  onDelegateHints: noop,
  onDelegateRouting: noop,
  onOpenDelegate: null,
  onTakeBackDelegate: noop,
};

type PagerParams = {
  readonly size: number;
};

const pagerOf = ({ size }: PagerParams): QuestionPagerModel | null =>
  size === 0
    ? null
    : {
        index: 0,
        doneFlags: Array.from({ length: size }, () => false),
        onPrevious: noop,
        onNext: noop,
        onJumpToOpen: null,
      };

type Props = {
  readonly entry: Case;
};

export const QuestionCardCase = ({ entry }: Props) => (
  <div data-qc-case={entry.name} className="min-w-0">
    <QuestionCard
      question={entry.question}
      variant={entry.variant}
      state={entry.state}
      askerName="Implementer"
      askerKind="planner"
      age="2m"
      draft={entry.draft}
      pager={pagerOf({ size: entry.pagerSize })}
      delegate={DELEGATE}
      answeredByName={entry.answeredByName}
      onToggleSuggestion={noop}
      onToggleCustomField={noop}
      onSetCustomAnswer={noop}
      onAnswer={noop}
      onSkip={noop}
      onUndo={entry.state === 'answered' ? noop : null}
      onDismiss={null}
    />
  </div>
);

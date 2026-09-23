// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { OpenQuestion, ProviderId } from '@goodboy/types';
import { CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { QUESTION_DELEGATE_COPY, type DelegateRowState } from '../../../questionDelegate';
import type { DelegateRouting } from '../useOpenQuestions';
import { QuestionCard } from '.';

afterEach(cleanup);

const LONG_OPTION =
  'rilancia lo step precedente dopo aver rebasato il branch, perché il refactor non è ancora ' +
  'arrivato su main e la build partirebbe dal codice vecchio';

const baseQuestion = {
  id: 'q1',
  text: 'pick a database',
  suggestedAnswers: ['sqlite', 'postgres'],
  createdAt: new Date().toISOString(),
  ownedByStepOrdinal: null,
  workflowId: null,
  isBlocking: false,
} as unknown as OpenQuestion;

const baseProps = {
  question: baseQuestion,
  selectedSuggestions: [] as ReadonlyArray<string>,
  customAnswer: '',
  showCustomField: false,
  justAnswered: false,
  onToggleSuggestion: vi.fn(),
  onSetCustomAnswer: vi.fn(),
  onToggleCustomField: vi.fn(),
  onDismiss: vi.fn(),
  onClearJustAnswered: vi.fn(),
  delegateState: 'available' as DelegateRowState,
  delegateHints: '',
  delegateRouting: {
    provider: 'anthropic',
    model: 'sonnet-5',
    effort: 'medium',
  } satisfies DelegateRouting,
  connectedProviders: ['anthropic'] as ReadonlyArray<ProviderId>,
  onChooseDelegate: vi.fn(),
  onCancelDelegate: vi.fn(),
  onDelegateHints: vi.fn(),
  onDelegateRouting: vi.fn(),
};

describe('QuestionCard', () => {
  it('reads as a quiet workflow surface', () => {
    const { container } = render(<QuestionCard {...baseProps} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain('border-l-2');
    expect(root.className).toContain('border-warning/40');
    expect(root.className).not.toContain('rounded-lg');
  });

  it('keeps just-answered feedback on the shared question tone', () => {
    const { container } = render(<QuestionCard {...baseProps} justAnswered />);
    const root = container.firstElementChild as HTMLElement;
    const questionTint = tintClasses(CONCEPT_TONE.questions);
    const feedbackIcon = screen
      .getByRole('button', { name: /dismiss question/i })
      .querySelector('svg');

    expect(root.className).toContain(questionTint.border);
    expect(root.className).not.toContain('success');
    expect(feedbackIcon?.getAttribute('class')).toContain(questionTint.icon);
  });

  it('renders the question text with one button per suggestion', () => {
    render(<QuestionCard {...baseProps} />);
    expect(screen.getByText('pick a database')).toBeDefined();
    expect(screen.getByRole('radio', { name: 'sqlite' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'postgres' })).toBeDefined();
  });

  it('fires onDismiss when the close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<QuestionCard {...baseProps} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss question/i }));
    expect(onDismiss).toHaveBeenCalledWith('q1');
  });

  it('marks a recommended answer that matches a suggestion and toggles it on click', () => {
    const onToggleSuggestion = vi.fn();
    const question = { ...baseQuestion, recommendedAnswer: 'sqlite' } as OpenQuestion;
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'sqlite' }));
    expect(onToggleSuggestion).toHaveBeenCalledWith('q1', 'sqlite', 'one');
  });

  it('prepends a free-form recommendation as a marked row when it is not a suggestion', () => {
    const onToggleSuggestion = vi.fn();
    const question = { ...baseQuestion, recommendedAnswer: 'use both' } as OpenQuestion;
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    fireEvent.click(
      screen.getByRole('radio', { name: 'use both', description: 'Recommended answer' }),
    );
    expect(onToggleSuggestion).toHaveBeenCalledWith('q1', 'use both', 'one');
  });

  it('names the recommended option by its answer text and describes the recommendation apart', () => {
    const question = { ...baseQuestion, recommendedAnswer: 'sqlite' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    const recommended = screen.getByRole('radio', {
      name: 'sqlite',
      description: 'Recommended answer',
    });
    expect(recommended.querySelector('svg')).not.toBeNull();
  });

  it('leaves an unselected recommendation with no primary or warning fill', () => {
    const question = { ...baseQuestion, recommendedAnswer: 'sqlite' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    const recommended = screen.getByRole('radio', { name: 'sqlite' });
    expect(recommended.className).not.toContain('bg-warning');
    expect(recommended.className).not.toContain('border-warning');
    expect(recommended.className).not.toContain('bg-primary');
    expect(recommended.className).not.toContain('ring-warning');
  });

  it('exposes chips as radios in a radiogroup for a single-choice question', () => {
    render(<QuestionCard {...baseProps} />);
    expect(screen.getByRole('radiogroup', { name: /pick one answer/i })).toBeDefined();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('exposes chips as checkboxes for a multi-choice question', () => {
    const question = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    const onToggleSuggestion = vi.fn();
    render(
      <QuestionCard {...baseProps} question={question} onToggleSuggestion={onToggleSuggestion} />,
    );
    const sqlite = screen.getByRole('checkbox', { name: 'sqlite' });
    const postgres = screen.getByRole('checkbox', { name: 'postgres' });
    fireEvent.click(sqlite);
    fireEvent.click(postgres);
    expect(onToggleSuggestion).toHaveBeenNthCalledWith(1, 'q1', 'sqlite', 'many');
    expect(onToggleSuggestion).toHaveBeenNthCalledWith(2, 'q1', 'postgres', 'many');
  });

  it('always exposes the "other" free-text trigger in both modes', () => {
    const single = render(<QuestionCard {...baseProps} />);
    expect(single.getByRole('button', { name: /other/i })).toBeDefined();
    single.unmount();
    const question = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);
    expect(screen.getByRole('button', { name: /other/i })).toBeDefined();
  });

  it('gives every option a row of its own, in one column', () => {
    render(<QuestionCard {...baseProps} />);
    const group = screen.getByRole('radiogroup', { name: /pick one answer/i });
    const options = screen.getAllByRole('radio');

    expect(group.className).toContain('flex-col');
    expect(group.className).not.toContain('flex-wrap');
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.className.includes('w-full'))).toBe(true);
  });

  it('reads a multi-choice question as one row per option too', () => {
    const question = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);
    const group = screen.getByRole('group', { name: /pick one or more answers/i });

    expect(group.className).toContain('flex-col');
    expect(screen.getAllByRole('checkbox').every((box) => box.className.includes('w-full'))).toBe(
      true,
    );
  });

  it('shows a sentence-long option whole instead of cutting it off', () => {
    const question = {
      ...baseQuestion,
      suggestedAnswers: [LONG_OPTION, 'postgres'],
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.getByRole('radio', { name: LONG_OPTION }).textContent).toBe(LONG_OPTION);
  });

  it('keeps the "other" row after the options, in the same full-width frame', () => {
    render(<QuestionCard {...baseProps} />);
    const other = screen.getByRole('button', { name: /other/i });
    const lastOption = screen.getByRole('radio', { name: 'postgres' });

    expect(other.className).toContain('w-full');
    expect(lastOption.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('puts the suggested answer first however late it arrived', () => {
    const question = {
      ...baseQuestion,
      suggestedAnswers: ['postgres', 'sqlite', 'duckdb'],
      recommendedAnswer: 'sqlite',
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.getAllByRole('radio').map((option) => option.textContent)).toEqual([
      'sqliteRecommended answer',
      'postgres',
      'duckdb',
    ]);
  });

  it('leaves the arrival order alone when no answer is marked suggested', () => {
    const question = {
      ...baseQuestion,
      suggestedAnswers: ['postgres', 'sqlite', 'duckdb'],
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.getAllByRole('radio').map((option) => option.textContent)).toEqual([
      'postgres',
      'sqlite',
      'duckdb',
    ]);
  });

  it('renders radios for a single-answer question and checkboxes for a multi-answer one', () => {
    const single = render(<QuestionCard {...baseProps} />);
    expect(single.getAllByRole('radio')).toHaveLength(2);
    expect(single.queryAllByRole('checkbox')).toHaveLength(0);
    single.unmount();

    const many = { ...baseQuestion, selectMode: 'many' } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={many} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('marks a blocking question with a filled chip and drops the dismiss control', () => {
    const question = { ...baseQuestion, isBlocking: true } as OpenQuestion;
    const { container } = render(<QuestionCard {...baseProps} question={question} />);
    const chip = screen.getByText('Blocking');

    expect(chip.className).toContain(tintClasses('warning').solid);
    expect(screen.queryByRole('button', { name: /dismiss question/i })).toBeNull();
    expect(container.querySelector('[data-testid="question-header"]')!.className).toContain(
      'grid-cols-[minmax(0,1fr)_28px]',
    );
  });

  it('tells a screen reader why a blocking question cannot wait', () => {
    const question = { ...baseQuestion, isBlocking: true } as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(
      screen.getByRole('radiogroup', {
        name: /pick one answer/i,
        description: /required before the artifact or plan/i,
      }),
    ).toBeDefined();
  });

  it('keeps the header column when the question is not blocking', () => {
    const { container } = render(<QuestionCard {...baseProps} />);

    expect(container.querySelector('[data-testid="question-header"]')!.className).toContain(
      'grid-cols-[minmax(0,1fr)_28px]',
    );
    expect(screen.getByRole('button', { name: /dismiss question/i })).toBeDefined();
  });

  it('reads the suggestions as unchecked while a custom answer is written', () => {
    render(
      <QuestionCard
        {...baseProps}
        selectedSuggestions={['sqlite']}
        customAnswer="use Neon"
        showCustomField
      />,
    );

    expect(screen.getByRole('radio', { name: 'sqlite' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(screen.getByDisplayValue('use Neon').closest('div')!.className).toContain(
      'bg-primary/10',
    );
  });

  it('renders no option group at all when the question carries no answers', () => {
    const question = {
      ...baseQuestion,
      text: 'anything else worth knowing',
      suggestedAnswers: [],
    } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} />);

    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('button', { name: /other/i })).toBeDefined();
  });

  it('names who asked and which step owns the question, without chips', () => {
    const question = { ...baseQuestion, ownedByStepOrdinal: 2 } as unknown as OpenQuestion;
    render(<QuestionCard {...baseProps} question={question} askedByName="scout" />);

    expect(screen.getByText('step 2')).toBeDefined();
    expect(screen.getByText('asked by scout')).toBeDefined();
  });
});

describe('QuestionCard delegation', () => {
  it('appends the hand-over as the last row, after the free text one', () => {
    const { container } = render(<QuestionCard {...baseProps} />);
    const rows = [...container.querySelectorAll('button')];
    const other = rows.findIndex((node) => node.textContent?.trim() === 'Other');
    const handOver = rows.findIndex(
      (node) => node.getAttribute('data-testid') === 'delegate-answer-row',
    );

    expect(other).toBeGreaterThan(-1);
    expect(handOver).toBeGreaterThan(other);
  });

  it('keeps the options in place while nothing is handed over', () => {
    render(<QuestionCard {...baseProps} />);

    expect(screen.getByRole('radio', { name: 'sqlite' })).toBeDefined();
    expect(screen.queryByTestId('delegate-answer-panel')).toBeNull();
    expect(screen.queryByTestId('delegate-hidden-options')).toBeNull();
  });

  it('collapses the options into one line and opens the panel once delegation is chosen', () => {
    render(<QuestionCard {...baseProps} delegateState="chosen" />);

    expect(screen.queryByRole('radio', { name: 'sqlite' })).toBeNull();
    expect(screen.queryByRole('button', { name: /other/i })).toBeNull();
    expect(screen.getByTestId('delegate-hidden-options').textContent).toBe('3 options hidden');
    expect(screen.getByTestId('delegate-answer-panel')).toBeDefined();
  });

  it('gives the panel the border of a chosen answer, because that is what it is', () => {
    render(<QuestionCard {...baseProps} delegateState="chosen" />);

    expect(screen.getByTestId('delegate-answer-panel').className).toContain('border-primary/40');
  });

  it('offers a way back to answering it yourself', () => {
    const onCancelDelegate = vi.fn();
    render(
      <QuestionCard {...baseProps} delegateState="chosen" onCancelDelegate={onCancelDelegate} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'answer it yourself' }));
    expect(onCancelDelegate).toHaveBeenCalledTimes(1);
  });

  it('leaves the hints empty and editable, never gating the hand-over on them', () => {
    const onDelegateHints = vi.fn();
    render(
      <QuestionCard {...baseProps} delegateState="chosen" onDelegateHints={onDelegateHints} />,
    );

    const hints = screen.getByLabelText('Hints for the delegated agent') as HTMLTextAreaElement;
    expect(hints.value).toBe('');
    expect(hints.hasAttribute('disabled')).toBe(false);
    fireEvent.change(hints, { target: { value: 'weigh the cost' } });
    expect(onDelegateHints).toHaveBeenCalledWith('weigh the cost');
  });

  it('collapses to a waiting row while a delegate is running, asking for nothing', () => {
    const onOpenDelegate = vi.fn();
    render(<QuestionCard {...baseProps} delegateState="running" onOpenDelegate={onOpenDelegate} />);

    expect(screen.queryByRole('radio', { name: 'sqlite' })).toBeNull();
    expect(screen.queryByTestId('delegate-answer-row')).toBeNull();
    expect(screen.getByText(QUESTION_DELEGATE_COPY.running)).toBeTruthy();

    fireEvent.click(screen.getByTestId('delegate-waiting-row'));
    expect(onOpenDelegate).toHaveBeenCalledTimes(1);
  });

  it('hands the question back from a running delegate', () => {
    const onTakeBackDelegate = vi.fn();
    render(
      <QuestionCard
        {...baseProps}
        delegateState="running"
        onTakeBackDelegate={onTakeBackDelegate}
      />,
    );

    fireEvent.click(screen.getByTestId('delegate-take-back'));
    expect(onTakeBackDelegate).toHaveBeenCalledTimes(1);
  });

  it('hides the dismiss control while a delegate is running', () => {
    render(<QuestionCard {...baseProps} delegateState="running" />);

    expect(screen.queryByLabelText('Dismiss question')).toBeNull();
  });
});

describe('blocking description without suggestions', () => {
  it('still describes why the question blocks when there is nothing to pick', () => {
    render(
      <QuestionCard
        {...baseProps}
        question={{ ...baseQuestion, isBlocking: true, suggestedAnswers: [] }}
      />,
    );

    const described = document.querySelector('[aria-describedby]');
    expect(described).not.toBeNull();
    const id = described?.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(id)?.textContent).toContain('required before the artifact');
  });
});

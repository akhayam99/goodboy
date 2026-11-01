// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type ProviderId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import type { QuestionDelegateControls } from '../../../hooks/useQuestionDelegateControls';
import { QuestionCard } from '.';

afterEach(cleanup);

const QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'question-window' }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  workflowRunId: brandId<WorkflowRunId>({ value: 'run-ledger-core' }),
  createdByAgentId: brandId<AgentId>({ value: 'agent-implementer' }),
  text: 'Should refunds older than 90 days be batched too?',
  suggestedAnswers: ['Batch them', 'Leave them out'],
  selectMode: 'one',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-30T09:00:00.000Z' }),
  isBlocking: true,
  status: 'open',
  userAnswer: null,
};

const PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic'];

const DELEGATE: QuestionDelegateControls = {
  delegateState: 'available',
  delegateHints: '',
  delegateRouting: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
  connectedProviders: PROVIDERS,
  onChooseDelegate: vi.fn(),
  onCancelDelegate: vi.fn(),
  onDelegateHints: vi.fn(),
  onDelegateRouting: vi.fn(),
  onOpenDelegate: null,
  onTakeBackDelegate: vi.fn(),
};

const PAGER = {
  index: 0,
  doneFlags: [false, false],
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onJumpToOpen: null,
};

type CardProps = ComponentProps<typeof QuestionCard>;

const renderCard = (patch: Partial<CardProps> = {}) => {
  const props: CardProps = {
    question: QUESTION,
    variant: 'compact',
    state: 'open',
    askerName: 'Implementer',
    askerKind: 'planner',
    age: '2m',
    draft: undefined,
    pager: null,
    delegate: DELEGATE,
    onToggleSuggestion: vi.fn(),
    onToggleCustomField: vi.fn(),
    onSetCustomAnswer: vi.fn(),
    onAnswer: vi.fn(),
    onSkip: vi.fn(),
    onSendAsMessage: vi.fn(),
    onUndo: null,
    onDismiss: null,
    ...patch,
  };
  const view = render(<QuestionCard {...props} />);
  return { props, view };
};

const card = (): HTMLElement => screen.getByRole('article');

type FirstRowParams = {
  readonly node: HTMLElement;
};

const isFirstRow = ({ node }: FirstRowParams): boolean => {
  let current: HTMLElement | null = node;
  while (current !== null && current !== card()) {
    if (current.previousElementSibling !== null) {
      return false;
    }
    current = current.parentElement;
  }
  return current === card();
};

const header = (): HTMLElement => {
  const row = card().querySelector<HTMLElement>('[data-question-header]');
  if (row === null) {
    throw new Error('the card has no header row');
  }
  return row;
};

describe('the question card header row', () => {
  it('holds Blocking and the question on the first row, with no pager', () => {
    renderCard();

    expect(isFirstRow({ node: header() })).toBe(true);
    within(header()).getByText('Blocking');
    within(header()).getByRole('heading', { name: QUESTION.text });
    expect(header().querySelector('[data-question-controls]')).toBeNull();
  });

  it('holds Blocking, the question and the pager on one first row', () => {
    renderCard({ pager: PAGER });

    expect(isFirstRow({ node: header() })).toBe(true);
    const row = within(header());
    row.getByText('Blocking');
    row.getByRole('heading', { name: QUESTION.text });
    row.getByText('1 of 2');
    row.getByRole('button', { name: 'Next question' });
  });

  it('keeps the dismiss button on the first row of a question that does not block', () => {
    renderCard({ question: { ...QUESTION, isBlocking: false }, onDismiss: vi.fn() });

    expect(isFirstRow({ node: header() })).toBe(true);
    within(header()).getByRole('button', { name: 'Dismiss question' });
    expect(within(header()).queryByText('Blocking')).toBeNull();
  });

  it('puts the asker row above a full card and Blocking beside the question', () => {
    renderCard({ variant: 'full', pager: PAGER });

    const top = card().firstElementChild;
    if (!(top instanceof HTMLElement)) {
      throw new Error('the full card has no first row');
    }
    expect(top).not.toBe(header());
    within(top).getByText('Implementer');
    within(top).getByText('1 of 2');
    within(header()).getByText('Blocking');
    expect(within(header()).queryByText('1 of 2')).toBeNull();
  });
});

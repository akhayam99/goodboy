// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { HelpCircle } from '@goodboy/ui/icons';
import type { BoardSignal } from '../boardSignalOf';
import type { WaitingRun } from '../waitingRunOf';
import type { DynamicAction } from './useDynamicActions';
import { signalActionOf } from './signalActionOf';

const QUESTION: BoardSignal = {
  kind: 'attention',
  reason: 'open-question',
  label: '1 question for you',
  word: '1 question for you',
};

const actionOf = ({ key }: { readonly key: string }): DynamicAction => ({
  key,
  icon: HelpCircle,
  tone: 'warning',
  label: '1 open question',
  onClick: vi.fn(),
});

const RUN: WaitingRun = JSON.parse('{"verb":"Review plan","words":"Plan is ready"}');

describe('signalActionOf', () => {
  it('hands the questions action to the question signal', () => {
    const action = actionOf({ key: 'questions' });
    expect(signalActionOf({ signal: QUESTION, action, isArchived: false, waitingRun: null })).toBe(
      action,
    );
  });

  it('hands the action that clears the same reason to the signal', () => {
    const action = actionOf({ key: 'attention:open-question' });
    expect(signalActionOf({ signal: QUESTION, action, isArchived: false, waitingRun: null })).toBe(
      action,
    );
  });

  it('keeps an action for another reason, a waiting run and an archived card on their own button', () => {
    const other = actionOf({ key: 'run' });
    const question = actionOf({ key: 'questions' });

    expect(
      signalActionOf({ signal: QUESTION, action: other, isArchived: false, waitingRun: null }),
    ).toBeNull();
    expect(
      signalActionOf({ signal: QUESTION, action: question, isArchived: false, waitingRun: RUN }),
    ).toBeNull();
    expect(
      signalActionOf({ signal: QUESTION, action: question, isArchived: true, waitingRun: null }),
    ).toBeNull();
    expect(
      signalActionOf({
        signal: { kind: 'none' },
        action: question,
        isArchived: false,
        waitingRun: null,
      }),
    ).toBeNull();
  });
});

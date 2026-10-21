// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { SESSION, questionFixture } from '../../../__tests__/helpers/actionFixtures';
import { landingLiveKey } from '../../chat/reveal/landingLiveKey';
import { liveTextRegistry } from '../../chat/reveal/liveTextRegistry';
import { AgentAnsweringFor } from './AgentDetailPane/AgentAnsweringFor';
import { DecisionRowItem } from './ContextDrawer/DecisionRowItem';

const DECISION_TEXT = 'Keep payments-api retries behind the ledger-core lock.';

const question = questionFixture({ text: 'Should notify-relay retry on a 409?' });

const renderDecision = ({ liveKey }: { readonly liveKey: string | null }) =>
  render(
    <DecisionRowItem
      number={1}
      text={DECISION_TEXT}
      liveKey={liveKey}
      why={null}
      byline="by implementer"
      isNew
      reworded={null}
      isLocked={false}
      isHighlighted={false}
      isOpen={false}
      isRemoved={false}
      rowRef={() => undefined}
      onToggleOpen={() => undefined}
      onReword={() => undefined}
      onRemove={() => undefined}
      onUndoRemove={() => undefined}
    />,
  );

const isFresh = ({ container }: { readonly container: HTMLElement }): boolean =>
  container.querySelector('[data-fresh]') !== null;

const DECISIONS_KEY = landingLiveKey({ scope: 'decisions', id: SESSION });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  liveTextRegistry.clear();
});

afterEach(() => {
  cleanup();
  liveTextRegistry.clear();
});

describe('a decision recorded during a live run', () => {
  it('fades in when the run notes it while the drawer is open', () => {
    void useAppStore.getState().noteDecisionChanges({
      sessionId: SESSION,
      changes: [{ kind: 'added', number: 1, text: DECISION_TEXT }],
    });

    const { container } = renderDecision({ liveKey: DECISIONS_KEY });

    expect(isFresh({ container })).toBe(true);
  });

  it('shows whole when the drawer loads it later', () => {
    const { container } = renderDecision({ liveKey: DECISIONS_KEY });

    expect(isFresh({ container })).toBe(false);
  });

  it('never fades a decision the user wrote', () => {
    liveTextRegistry.mark({ runId: DECISIONS_KEY });

    const { container } = renderDecision({ liveKey: null });

    expect(isFresh({ container })).toBe(false);
  });

  it('marks nothing when a run notes no change', () => {
    void useAppStore.getState().noteDecisionChanges({ sessionId: SESSION, changes: [] });

    expect(liveTextRegistry.isLanding({ runId: DECISIONS_KEY })).toBe(false);
  });
});

describe('the question an agent answers for', () => {
  it('fades in when the question lands while the user looks', () => {
    liveTextRegistry.mark({ runId: landingLiveKey({ scope: 'questions', id: SESSION }) });

    const { container, getByText } = render(
      <AgentAnsweringFor sessionId={SESSION} question={question} asker={null} />,
    );

    getByText('Should notify-relay retry on a 409?');
    expect(isFresh({ container })).toBe(true);
  });

  it('shows a loaded question whole', () => {
    const { container } = render(
      <AgentAnsweringFor sessionId={SESSION} question={question} asker={null} />,
    );

    expect(isFresh({ container })).toBe(false);
  });
});

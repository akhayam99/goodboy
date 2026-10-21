// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TEST_NOW, anAgent, nextAgentId, nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { TranscriptItem } from '../utils/transcript-items';
import { OrchestratorDecisionCard } from '../components/OrchestratorDecisionCard';
import { PhaseTransitionCard } from '../components/PhaseTransitionCard';
import { ResolverThreadsCard } from '../components/ResolverThreadsCard';
import { ScribeTextCard } from '../components/ScribeTextCard';
import { landingLiveKey } from './landingLiveKey';
import { liveTextRegistry } from './liveTextRegistry';

const SESSION = nextSessionId();
const SCRIBE = nextAgentId();
const RUN = 'run-ledger-core';
const AT = TEST_NOW;
const VERDICT_TEXT =
  'Checked it.\n<<comment-wontfix threadId="PRRT_ledger1" reason="already covered upstream">>';
const SCRIBE_TEXT = [
  '<<pr-title>>',
  'Make ledger postings idempotent across retried batches',
  '<</pr-title>>',
  '<<pr-body>>',
  'Retried settlement batches no longer post twice.',
  '<</pr-body>>',
].join('\n');

const decision = {
  kind: 'orchestrator_decision',
  key: 'orchestrator-1',
  action: 'next',
  reason: 'the gate landed so the tests come next',
  stepName: 'write the gate tests',
  at: AT,
} satisfies Extract<TranscriptItem, { kind: 'orchestrator_decision' }>;

const transition = {
  kind: 'step_transition',
  key: 'phase-1',
  at: AT,
  fromStep: { ordinal: 0, name: 'discover' },
  toStep: { ordinal: 1, name: 'plan' },
  carryForwardContext: 'carry me forward',
} satisfies Extract<TranscriptItem, { kind: 'step_transition' }>;

const isFresh = ({ container }: { readonly container: HTMLElement }): boolean =>
  container.querySelector('[data-fresh]') !== null;

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

describe('resolve verdicts in the transcript', () => {
  const renderCard = () =>
    render(<ResolverThreadsCard assistantText={VERDICT_TEXT} sessionId={SESSION} runId={RUN} />);

  it('fade in when they mount as the live answer finishes revealing', () => {
    liveTextRegistry.mark({ runId: RUN });

    const { container, getByText } = renderCard();

    getByText('already covered upstream');
    expect(isFresh({ container })).toBe(true);
  });

  it('show whole in a loaded transcript', () => {
    const { container } = renderCard();

    expect(isFresh({ container })).toBe(false);
  });
});

describe('the pull request text a scribe writes', () => {
  const renderCard = () =>
    render(
      <ScribeTextCard
        assistantText={SCRIBE_TEXT}
        sessionId={SESSION}
        agentId={SCRIBE}
        runId={RUN}
      />,
    );

  beforeEach(() => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION]: [anAgent({ id: SCRIBE, sessionId: SESSION, kind: 'scribe' })],
      },
    });
  });

  it('fades in when it mounts as the live answer finishes revealing', () => {
    liveTextRegistry.mark({ runId: RUN });

    const { container, getByText } = renderCard();

    getByText('Make ledger postings idempotent across retried batches');
    expect(isFresh({ container })).toBe(true);
  });

  it('shows whole in a loaded transcript', () => {
    const { container } = renderCard();

    expect(isFresh({ container })).toBe(false);
  });
});

describe('orchestrator decisions and step transitions', () => {
  it('fade in once when the event was just written', () => {
    liveTextRegistry.mark({ runId: landingLiveKey({ scope: 'transcript-event', id: AT }) });

    const decisionCard = render(<OrchestratorDecisionCard item={decision} />);
    const transitionCard = render(<PhaseTransitionCard item={transition} />);

    expect(isFresh({ container: decisionCard.container })).toBe(true);
    expect(isFresh({ container: transitionCard.container })).toBe(true);
  });

  it('show whole when the transcript is loaded', () => {
    const decisionCard = render(<OrchestratorDecisionCard item={decision} />);
    const transitionCard = render(<PhaseTransitionCard item={transition} />);

    expect(isFresh({ container: decisionCard.container })).toBe(false);
    expect(isFresh({ container: transitionCard.container })).toBe(false);
  });

  it('never fade an older event when a newer one lands', () => {
    liveTextRegistry.mark({
      runId: landingLiveKey({ scope: 'transcript-event', id: '2026-10-21T09:05:00.000Z' }),
    });

    const { container } = render(<OrchestratorDecisionCard item={decision} />);

    expect(isFresh({ container })).toBe(false);
  });
});

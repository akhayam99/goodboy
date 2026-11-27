// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
  type TurnState,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { NeedsYouSection } from './NeedsYouSection';
import { useSessionPermissionAsk } from './useSessionPermissionAsk';

const session = aSession();
const SESSION_ID = session.id;
const lead = anAgent({ sessionId: SESSION_ID });
const AT = brandId<IsoDateTime>({ value: '2026-11-27T09:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-ledger-core' });
const BLOCKED: TurnState = { kind: 'blocked', runId: RUN, blockedAt: AT };

const request: TurnEvent = {
  kind: 'permission_request',
  runId: RUN,
  toolUseId: 'tool-1',
  toolName: 'Bash',
  input: { command: 'pnpm test in payments-api' },
  at: AT,
};

const decision: TurnEvent = {
  kind: 'permission_decision',
  runId: RUN,
  toolUseId: 'tool-1',
  decision: 'allow',
  scope: 'once',
  ruleId: null,
  decidedBy: 'user',
  at: AT,
};

let useAppStore: StoryStore;

const actionsFor: ActionCardActions['actionsFor'] = () => ({
  main: null,
  second: null,
  failure: null,
  isBusy: false,
  agentKind: null,
  menu: null,
  foldedTarget: null,
});

const Probe = () => {
  const permission = useSessionPermissionAsk({ sessionId: SESSION_ID, isEnabled: true });
  return (
    <NeedsYouSection
      sessionId={SESSION_ID}
      cards={[]}
      questions={[]}
      permission={permission}
      actionsFor={actionsFor}
      openFor={() => null}
      kickerById={new Map()}
    />
  );
};

const waits = ({ isBlocked }: { readonly isBlocked: boolean }) =>
  useAppStore.setState({
    sessionPhaseRuns: { [SESSION_ID]: [lead] },
    transcripts: { [lead.id]: isBlocked ? [request] : [] },
    agentTurnState: isBlocked ? { [lead.id]: BLOCKED } : {},
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('Needs you for a Lead waiting on a permission', () => {
  it('shows exactly one tile with one action that allows the call', () => {
    waits({ isBlocked: true });
    render(<Probe />);
    expect(document.querySelectorAll('[data-move^="permission:"]')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Allow and continue' })).toHaveLength(1);
  });

  it('allows through the existing action and drops the tile once answered', async () => {
    waits({ isBlocked: true });
    const allowAndContinue = vi.fn(async () => {
      useAppStore.setState((state) => ({
        transcripts: { ...state.transcripts, [lead.id]: [request, decision] },
        agentTurnState: {},
      }));
    });
    useAppStore.setState({ allowAndContinue });
    render(<Probe />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow and continue' }));
    });
    expect(allowAndContinue).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-move^="permission:"]')).toHaveLength(0);
  });

  it('shows the full request on demand', () => {
    waits({ isBlocked: true });
    render(<Probe />);
    expect(document.querySelector('pre')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show full request' }));
    expect(document.querySelector('pre')?.textContent).toContain('pnpm test in payments-api');
  });

  it('loads the transcript of a blocked agent that has none yet', () => {
    const loadAgentTranscript = vi.fn(async () => undefined);
    useAppStore.setState({
      loadAgentTranscript,
      sessionPhaseRuns: { [SESSION_ID]: [lead] },
      transcripts: {},
      agentTurnState: { [lead.id]: BLOCKED },
    });
    render(<Probe />);
    expect(loadAgentTranscript).toHaveBeenCalledWith(SESSION_ID, lead.id, { isSelecting: false });
  });

  it('shows the full request on demand', () => {
    waits({ isBlocked: true });
    render(<Probe />);
    expect(document.querySelector('pre')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show full request' }));
    expect(document.querySelector('pre')?.textContent).toContain('pnpm test in payments-api');
  });

  it('loads the transcript of a blocked agent that has none yet', () => {
    const loadAgentTranscript = vi.fn(async () => undefined);
    useAppStore.setState({
      loadAgentTranscript,
      sessionPhaseRuns: { [SESSION_ID]: [lead] },
      transcripts: {},
      agentTurnState: { [lead.id]: BLOCKED },
    });
    render(<Probe />);
    expect(loadAgentTranscript).toHaveBeenCalledWith(SESSION_ID, lead.id, { isSelecting: false });
  });

  it('shows no tile when nothing waits', () => {
    waits({ isBlocked: false });
    render(<Probe />);
    expect(document.querySelector('[data-overview-section="needs-you"]')).toBeNull();
  });
});

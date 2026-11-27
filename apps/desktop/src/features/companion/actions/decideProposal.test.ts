// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type TurnEvent } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { aDelegation, aPlanRow, aView } from '../../auto/testing/autoViewFixtures';
import { registerDelegationDecisionPort } from '../../auto/delegationDecisionPort';
import type { DecideProposalAction } from '../contract/actions';
import { parseDecideAction } from './parseDecideAction';
import { expectedActionIdOf } from './actionIds';
import { decideProposal } from './decideProposal';
import { transcriptEntriesOf } from './transcriptOf';
import { fixtureOf } from './testing/decideTestKit';
import { proposalVersionOf } from './versions';
import type { DecidePorts } from './handlerTypes';

const SESSION = 'ses-ledger-core';
const ROOT = 'agent-auto';

const delegation = aDelegation({
  key: 'impl',
  role: 'implementer',
  state: 'awaiting_confirm',
  alternatives: [{ label: 'Scout the ledger first', role: 'scout' }],
});

const storeOf = ({
  sendTurn,
}: {
  readonly sendTurn: ReturnType<typeof vi.fn>;
}): (() => AppStore) => {
  const view = aView({ phase: 'waiting', delegations: [delegation], artifacts: [aPlanRow()] });
  const store = {
    autoTreeViews: { [SESSION]: [{ ...view, tree: { ...view.tree, rootAgentId: ROOT } }] },
    sessionPhaseRuns: {},
  };
  const built = Object.assign(fixtureOf<AppStore>({ value: store }), { sendTurn });
  return () => built;
};

const actionOf = ({
  choice,
  seenVersion = proposalVersionOf({ delegation }),
}: {
  readonly choice: DecideProposalAction['choice'];
  readonly seenVersion?: string;
}): DecideProposalAction => ({
  kind: 'decideProposal',
  actionId: `act:decideProposal:${delegation.id}.${choice}:${seenVersion}`,
  workspaceId: 'ws-harborline',
  sessionId: SESSION,
  delegationId: delegation.id,
  seenVersion,
  choice,
});

const ports = fixtureOf<DecidePorts>({ value: {} });

afterEach(() => registerDelegationDecisionPort({ port: null }));

describe('decideProposal', () => {
  it('parses and names its id the way the projection does', () => {
    const action = actionOf({ choice: 'alternative-0' });

    expect(parseDecideAction({ raw: action })).toEqual(action);
    expect(expectedActionIdOf({ action })).toBe(action.actionId);
  });

  it('confirms the proposal on Start', async () => {
    const port = vi.fn().mockResolvedValue('confirmed');
    registerDelegationDecisionPort({ port });

    const result = await decideProposal({
      action: actionOf({ choice: 'primary' }),
      getStore: storeOf({ sendTurn: vi.fn() }),
      ports,
    });

    expect(result.kind).toBe('done');
    expect(port).toHaveBeenCalledWith({ delegationId: delegation.id, decision: 'confirm' });
  });

  it('declines on Not now and sends nothing to the Lead', async () => {
    const port = vi.fn().mockResolvedValue('declined');
    const sendTurn = vi.fn();
    registerDelegationDecisionPort({ port });

    const result = await decideProposal({
      action: actionOf({ choice: 'notNow' }),
      getStore: storeOf({ sendTurn }),
      ports,
    });

    expect(result.kind).toBe('done');
    expect(port).toHaveBeenCalledWith({ delegationId: delegation.id, decision: 'decline' });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('declines, then tells the Lead the alternative that was picked', async () => {
    const port = vi.fn().mockResolvedValue('declined');
    const sendTurn = vi.fn().mockResolvedValue(undefined);
    registerDelegationDecisionPort({ port });

    const result = await decideProposal({
      action: actionOf({ choice: 'alternative-0' }),
      getStore: storeOf({ sendTurn }),
      ports,
    });

    expect(result.kind).toBe('done');
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: brandId<AgentId>({ value: ROOT }),
        content: 'Next step: scout',
        origin: 'operator',
      }),
    );
  });

  it('refuses a stale version without touching the Mac', async () => {
    const port = vi.fn();
    registerDelegationDecisionPort({ port });

    const result = await decideProposal({
      action: actionOf({ choice: 'primary', seenVersion: 'old' }),
      getStore: storeOf({ sendTurn: vi.fn() }),
      ports,
    });

    expect(result).toMatchObject({ kind: 'refused', refusal: { code: 'version-changed' } });
    expect(port).not.toHaveBeenCalled();
  });

  it('refuses a proposal already decided on the Mac', async () => {
    registerDelegationDecisionPort({ port: vi.fn().mockResolvedValue('lost') });

    const result = await decideProposal({
      action: actionOf({ choice: 'primary' }),
      getStore: storeOf({ sendTurn: vi.fn() }),
      ports,
    });

    expect(result).toMatchObject({ kind: 'refused', refusal: { code: 'already-decided' } });
  });

  it('refuses a delegation that is not on the Mac', async () => {
    const result = await decideProposal({
      action: { ...actionOf({ choice: 'primary' }), delegationId: 'delegation-missing' },
      getStore: storeOf({ sendTurn: vi.fn() }),
      ports,
    });

    expect(result).toMatchObject({ kind: 'refused', refusal: { code: 'unknown-target' } });
  });
});

describe('transcript for the phone', () => {
  const AUTO =
    '<<auto>>{"action":"propose","primary":{"role":"implementer","task":"Round it"}}<</auto>>';
  const textEvent = ({ delta, runId }: { readonly delta: string; readonly runId: string }) =>
    fixtureOf<TurnEvent>({
      value: { kind: 'assistant_text', runId, delta, at: '2026-11-27T09:00:00.000Z' },
    });

  it('never carries a raw auto block', () => {
    const entries = transcriptEntriesOf({
      events: [textEvent({ runId: 'r1', delta: `I suggest an implementer.\n\n${AUTO}` })],
    });

    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries)).not.toContain('auto>>');
    expect(JSON.stringify(entries)).toContain('I suggest an implementer.');
  });

  it('leaves out a message that was only an auto block', () => {
    const entries = transcriptEntriesOf({ events: [textEvent({ runId: 'r1', delta: AUTO })] });

    expect(entries).toEqual([]);
  });
});

import { CONFIRM_REFUSED_REASON } from '../../auto/CONFIRM_REFUSED_REASON';
import {
  currentDelegationDecisionPort,
  type DelegationDecisionResult,
} from '../../auto/delegationDecisionPort';
import { nextStepMessageOf } from '../../auto/chat/nextActionOf';
import { awaitingProposalOf } from '../projections/awaitingProposalOf';
import type { DecideActionOf } from './decideAction';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import type { HandlerParams, HandlerResult } from './handlerTypes';
import { agentIdOf, sessionIdOf } from './ids';
import { proposalVersionOf } from './versions';

const NOT_READY = "Your Mac can't take this answer yet.";
const GONE = 'This proposal was already decided on your Mac.';

type LostParams = {
  readonly result: DelegationDecisionResult;
};

const lostResultOf = ({ result }: LostParams): HandlerResult | null =>
  result === 'lost' ? refusedResult({ code: 'already-decided', message: GONE }) : null;

export const decideProposal = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'decideProposal'>>): Promise<HandlerResult> => {
  const store = getStore();
  const sessionId = sessionIdOf({ value: action.sessionId });
  const views = store.autoTreeViews[sessionId] ?? [];
  const known = views
    .flatMap((view) => view.delegations)
    .find((delegation) => delegation.id === action.delegationId);
  if (known === undefined) {
    return refusedResult({ code: 'unknown-target', message: "This proposal isn't on your Mac." });
  }
  const found =
    known.state === 'awaiting_confirm'
      ? awaitingProposalOf({
          views,
          agents: store.sessionPhaseRuns[sessionId] ?? [],
          delegationId: action.delegationId,
        })
      : null;
  if (found === null) {
    return refusedResult({ code: 'already-decided', message: GONE });
  }
  const version = proposalVersionOf({ delegation: found.delegation });
  if (version !== action.seenVersion) {
    return refusedResult({
      code: 'version-changed',
      message: 'The Lead changed this proposal.',
      changes: [{ label: 'Proposal', was: action.seenVersion, now: version }],
    });
  }
  const port = currentDelegationDecisionPort();
  if (port === null) {
    return failedResult({ error: NOT_READY });
  }
  const delegationId = action.delegationId;
  try {
    if (action.choice === 'primary') {
      const result = await port({ delegationId, decision: 'confirm' });
      if (result === 'refused') {
        return refusedResult({ code: 'invalid-request', message: CONFIRM_REFUSED_REASON });
      }
      return lostResultOf({ result }) ?? doneResult();
    }
    const declined = await port({ delegationId, decision: 'decline' });
    const lost = lostResultOf({ result: declined });
    if (lost !== null || action.choice === 'notNow') {
      return lost ?? doneResult();
    }
    const choice = found.action.choices.find((candidate) => candidate.key === action.choice);
    if (choice === undefined) {
      return failedResult({ error: 'This option is no longer offered.' });
    }
    await store.sendTurn({
      sessionId,
      agentId: agentIdOf({ value: found.view.tree.rootAgentId }),
      content: nextStepMessageOf({ choice, hint: '' }),
      origin: 'operator',
    });
    return doneResult();
  } catch (error) {
    console.error('[bridge] decideProposal failed', error);
    return failedResult({ error: "Couldn't send your answer to the Lead." });
  }
};

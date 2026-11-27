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
import {
  forgetProposalDelivery,
  pendingProposalDeliveryOf,
  rememberProposalDelivery,
  type ProposalDelivery,
} from './proposalDeliveries';
import { proposalVersionOf } from './versions';
import type { AppStore } from '../../../store/store';

const NOT_READY = "Your Mac can't take this answer yet.";
const GONE = 'This proposal was already decided on your Mac.';

type LostParams = {
  readonly result: DelegationDecisionResult;
};

const lostResultOf = ({ result }: LostParams): HandlerResult | null =>
  result === 'lost' ? refusedResult({ code: 'already-decided', message: GONE }) : null;

type DeliverParams = {
  readonly store: AppStore;
  readonly delegationId: string;
  readonly delivery: ProposalDelivery;
};

const deliverNextStep = async ({
  store,
  delegationId,
  delivery,
}: DeliverParams): Promise<HandlerResult> => {
  try {
    await store.sendTurn({
      sessionId: sessionIdOf({ value: delivery.sessionId }),
      agentId: agentIdOf({ value: delivery.agentId }),
      content: delivery.content,
      origin: 'operator',
    });
    forgetProposalDelivery({ delegationId });
    return doneResult();
  } catch (error) {
    console.error('[bridge] decideProposal delivery failed', error);
    return failedResult({
      error: "The proposal was declined, but the Lead didn't get your choice. Try again.",
    });
  }
};

export const decideProposal = async ({
  action,
  getStore,
}: HandlerParams<DecideActionOf<'decideProposal'>>): Promise<HandlerResult> => {
  const store = getStore();
  const delegationId = action.delegationId;
  const waiting = pendingProposalDeliveryOf({ delegationId });
  if (waiting !== null && waiting.choice === action.choice) {
    return deliverNextStep({ store, delegationId, delivery: waiting });
  }
  const sessionId = sessionIdOf({ value: action.sessionId });
  const views = store.autoTreeViews[sessionId] ?? [];
  const known = views
    .flatMap((view) => view.delegations)
    .find((delegation) => delegation.id === delegationId);
  if (known === undefined) {
    return refusedResult({ code: 'unknown-target', message: "This proposal isn't on your Mac." });
  }
  const found =
    known.state === 'awaiting_confirm'
      ? awaitingProposalOf({
          views,
          agents: store.sessionPhaseRuns[sessionId] ?? [],
          delegationId,
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
  const isAlternative = action.choice !== 'primary' && action.choice !== 'notNow';
  const choice = isAlternative
    ? found.action.choices.find((candidate) => candidate.key === action.choice)
    : undefined;
  if (isAlternative && choice === undefined) {
    return refusedResult({
      code: 'invalid-request',
      message: 'This option is not offered. The proposal is unchanged.',
    });
  }
  const port = currentDelegationDecisionPort();
  if (port === null) {
    return failedResult({ error: NOT_READY });
  }
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
    if (lost !== null || choice === undefined) {
      return lost ?? doneResult();
    }
    const delivery: ProposalDelivery = {
      sessionId: action.sessionId,
      agentId: found.view.tree.rootAgentId,
      choice: action.choice,
      content: nextStepMessageOf({ choice, hint: '' }),
    };
    rememberProposalDelivery({ delegationId, delivery });
    return deliverNextStep({ store, delegationId, delivery });
  } catch (error) {
    console.error('[bridge] decideProposal failed', error);
    return failedResult({ error: "Couldn't send your answer to the Lead." });
  }
};

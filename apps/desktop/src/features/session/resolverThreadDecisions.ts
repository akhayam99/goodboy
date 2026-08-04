import type { ResolverAction } from './resolverActions';
import type { ResolverThreadSettlement } from './resolverThreadSettlements';

export type ResolverThreadDecision = {
  readonly action: ResolverAction;
  readonly hint: string;
  readonly needsNotes: boolean;
  readonly isRecommended: boolean;
};

export type ResolverThreadDecisionPlan = {
  readonly question: string;
  readonly decisions: ReadonlyArray<ResolverThreadDecision>;
};

type Params = {
  readonly settlement: ResolverThreadSettlement;
  readonly prNumber: number | null;
  readonly isBusy: boolean;
};

const decision = ({
  action,
  hint,
  needsNotes = false,
  isRecommended = false,
}: {
  readonly action: ResolverAction;
  readonly hint: string;
  readonly needsNotes?: boolean;
  readonly isRecommended?: boolean;
}): ResolverThreadDecision => ({ action, hint, needsNotes, isRecommended });

const POST_AND_CLOSE: ResolverAction = {
  kind: 'explain',
  label: 'Post & close',
  role: 'alert',
  isEnabled: true,
  confirm: {
    role: 'alert',
    title: 'Post this reply and close the thread?',
    description: 'Publishes the reply above on GitHub and closes the thread without a fix.',
    confirmLabel: 'Post & close',
  },
  opensInspector: false,
};

const MARK_RESOLVED: ResolverAction = {
  kind: 'forceResolve',
  label: 'Mark resolved',
  role: 'alert',
  isEnabled: true,
  confirm: {
    role: 'alert',
    title: 'Mark this thread resolved?',
    description: 'Closes it on GitHub with the reply above, without waiting for a verdict.',
    confirmLabel: 'Mark resolved',
  },
  opensInspector: false,
};

const FIX_ANYWAY: ResolverAction = {
  kind: 'fix',
  label: 'Fix it anyway',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const REWORK: ResolverAction = {
  kind: 'rework',
  label: 'Ask for a new reply',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const REDO: ResolverAction = {
  kind: 'redo',
  label: 'Redo with hints',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const CUSTOM: ResolverAction = {
  kind: 'custom',
  label: 'Write something else',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const DEQUEUE: ResolverAction = {
  kind: 'dequeue',
  label: 'Remove from batch',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
};

const queueAction = ({ isEnabled }: { readonly isEnabled: boolean }): ResolverAction => ({
  kind: 'queue',
  label: 'Add to batch',
  role: 'primary',
  isEnabled,
  confirm: null,
  opensInspector: false,
});

const CLOSED: ResolverThreadDecisionPlan = {
  question: 'Closed on GitHub, nothing left to decide.',
  decisions: [],
};

const askAgain = ({
  isBusy,
}: {
  readonly isBusy: boolean;
}): ReadonlyArray<ResolverThreadDecision> =>
  isBusy
    ? []
    : [
        decision({
          action: CUSTOM,
          hint: 'Send your own instruction for this thread',
          needsNotes: true,
        }),
      ];

const committedPlan = ({ settlement, prNumber, isBusy }: Params): ResolverThreadDecisionPlan => {
  if (settlement.isQueued) {
    return {
      question: 'The fix is committed and waiting in the push batch.',
      decisions: [decision({ action: DEQUEUE, hint: 'Take it out of the batch' })],
    };
  }
  return {
    question: 'The agent committed a fix for this thread and drafted the reply to post.',
    decisions: [
      decision({
        action: queueAction({ isEnabled: prNumber !== null }),
        hint: 'Commit joins the batch, pushed when you run it',
        isRecommended: true,
      }),
      ...(isBusy
        ? []
        : [
            decision({
              action: REDO,
              hint: 'Send hints and have the change redone',
              needsNotes: true,
            }),
          ]),
      ...askAgain({ isBusy }),
    ],
  };
};

const settledPlan = ({ settlement, isBusy }: Params): ResolverThreadDecisionPlan => ({
  question:
    settlement.kind === 'wontfix'
      ? 'The agent judged this thread not worth a change, and wrote why.'
      : 'The agent analyzed this thread without changing anything, and drafted an answer.',
  decisions: [
    decision({
      action: POST_AND_CLOSE,
      hint: 'Posts the reply above and closes the thread',
      isRecommended: true,
    }),
    ...(isBusy
      ? []
      : [
          decision({ action: FIX_ANYWAY, hint: 'Refuse the verdict and have the change made' }),
          decision({ action: REWORK, hint: 'Keep the verdict, ask for a different reply' }),
        ]),
    ...askAgain({ isBusy }),
  ],
});

const openPlan = ({ isBusy }: Params): ResolverThreadDecisionPlan => ({
  question: 'The agent recorded no outcome for this thread.',
  decisions: [
    decision({ action: MARK_RESOLVED, hint: 'Close it yourself with the reply above' }),
    ...askAgain({ isBusy }),
  ],
});

export const resolverThreadDecisions = (params: Params): ResolverThreadDecisionPlan => {
  if (params.settlement.isClosed) {
    return CLOSED;
  }
  if (params.settlement.kind === 'resolved') {
    return committedPlan(params);
  }
  if (params.settlement.kind === 'open') {
    return openPlan(params);
  }
  return settledPlan(params);
};

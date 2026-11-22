import { useId, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  MountId,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { openLink } from '../../../open/openLink';
import { useAppStore } from '../../../../store';
import { captureStartHint } from '../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { modelLabel } from '../../../chat/utils/chat-constants';
import type { ItemWorkState } from '../../../live-state/itemWork/itemWorkWords';
import { analyzeFailingChecks } from '../../checks/analyzeFailingChecks';
import { causeSentenceOf } from '../../checks/causeSentenceOf';
import { checkAnalysisOf } from '../../checks/checkAnalysisOf';
import { checkItemWorkStateOf } from '../../checks/checkItemWorkStateOf';
import { checkOutcomeOf } from '../../checks/checkOutcomeOf';
import { checkRoutingOf } from '../../checks/checkRoutingOf';
import { checkRowResultOf } from '../../checks/checkRowResultOf';
import { startCheckFix } from '../../checks/startCheckFix';
import { useCheckChain } from '../../hooks/useCheckChain';
import { useCheckFixPush } from '../../hooks/useCheckFixPush';
import { useCheckWorkLock } from '../../hooks/useCheckWorkLock';
import { AnalyzedCheckWork } from '../AnalyzedCheckWork';
import { CheckAnalysisHint } from '../CheckAnalysisHint';
import type { StartParams } from '../CheckAnalysisDrawer/ProposedFix';
import { CheckProposalInline } from '../CheckProposalInline';
import { CheckResultAction } from '../CheckResultAction';
import { CheckLogInline } from './CheckLogInline';
import { useCheckLog } from './useCheckLog';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly pullRequest: PullRequestState | PullRequestView;
  readonly check: PrCheckRun;
  readonly url: string;
  readonly renderRow: RenderRow;
};

type RowParts = {
  readonly footnote?: string;
  readonly work: ReactNode;
  readonly isAgentWorking: boolean;
  readonly action: ReactNode;
  readonly hint: ReactNode;
  readonly isExpanded?: boolean;
  readonly controlsId?: string;
  readonly onOpen: () => void;
};

type RenderRow = (parts: RowParts) => ReactNode;

type ResultParams = {
  readonly state: ItemWorkState;
};

const NO_EVENTS = [] as const;

export const AnalyzedCheckRow = ({
  sessionId,
  mountId,
  pullRequest,
  check,
  url,
  renderRow,
}: Props) => {
  const { chain, events, turnState } = useCheckChain({ sessionId, mountId, url });
  const lock = useCheckWorkLock({ sessionId, mountId });
  const routing = useAppStore(useShallow((state) => checkRoutingOf({ state, sessionId, mountId })));
  const openDrawer = useAppStore((state) => state.openDrawer);
  const dismissCheckProposal = useAppStore((state) => state.dismissCheckProposal);
  const isDrawerOpen = useAppStore(
    (state) =>
      state.drawer?.kind === 'check-analysis' &&
      state.drawer.payload.mountId === mountId &&
      state.drawer.payload.checkUrl === url,
  );
  const checkFixPush = useCheckFixPush({ sessionId, mountId, fixAgentId: chain.fix?.id });
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const log = useCheckLog({
    sessionId,
    mountId,
    prNumber: pullRequest.number,
    check,
    isUnanalyzed: chain.state === 'none',
  });
  const logId = useId();
  const pending = usePendingAction({ sessionId });
  const analyzeKey = `check.analyze:${mountId}:${url}`;
  const fixKey = `check.fix:${mountId}:${url}`;
  const isAnalyzeStarting = pending.pendingKeys.has(analyzeKey);
  const isFixStarting = pending.pendingKeys.has(fixKey);
  const analyze = (): void => {
    const state = useAppStore.getState();
    const capture =
      chain.state === 'none'
        ? null
        : captureStartHint({
            state,
            sessionId,
            scope: START_HINT_SCOPES.checkAnalyze({ mountId, url }),
          });
    void pending.run({
      key: analyzeKey,
      failureTitle: "Couldn't start the Debugger",
      task: () =>
        analyzeFailingChecks({
          sessionId,
          mountId,
          pullRequest,
          checks: [check],
          ...(capture !== null && {
            hint: capture.text,
            onAccepted: () => state.settleStartHint({ capture }),
          }),
        }),
    });
  };
  const hintScope = START_HINT_SCOPES.checkFix({ mountId, url });
  const startFix = ({ optionKey }: StartParams): void => {
    const state = useAppStore.getState();
    const capture = captureStartHint({ state, sessionId, scope: hintScope });
    void pending.run({
      key: fixKey,
      failureTitle: "Couldn't start the Implementer",
      task: () =>
        startCheckFix({
          sessionId,
          url,
          mountId,
          hint: capture.text,
          onAccepted: () => state.settleStartHint({ capture }),
          ...(optionKey !== undefined && { optionKey }),
        }),
    });
  };
  const openAnalysis = (): void =>
    openDrawer({
      kind: 'check-analysis',
      sessionId,
      payload: { sessionId, mountId, checkUrl: url },
    });
  const analysis =
    chain.debugger === null
      ? null
      : checkAnalysisOf({ agent: chain.debugger, events: events ?? NO_EVENTS, turnState });
  const facts = {
    chain: chain.state,
    fixStatus: chain.fix?.status ?? null,
    debuggerStatus: chain.debugger?.status ?? null,
    checkOutcome: checkOutcomeOf({ checks: [check], name: check.name, analyzedUrl: url }),
  };
  const settled = checkItemWorkStateOf({ ...facts, isStarting: false });
  const workState = checkItemWorkStateOf({
    ...facts,
    isStarting: isAnalyzeStarting || isFixStarting,
  });
  const resultOf = ({ state }: ResultParams) =>
    checkRowResultOf({
      state,
      chain: chain.state,
      commit: chain.commit,
      cause: analysis === null ? null : causeSentenceOf({ text: analysis.finding }),
      isDismissed: chain.isDismissed,
    });
  const result = workState === null ? null : resultOf({ state: workState });
  const isLogInline = log.isShown && workState === null;
  const proposal = analysis?.proposal ?? null;
  const isProposalShown =
    isReviewOpen && settled === 'causeFound' && proposal !== null && !isDrawerOpen;
  const openRow = (): void => {
    if (chain.state !== 'none') {
      openAnalysis();
      return;
    }
    if (!log.isReadable) {
      openLink({ url, sessionId });
      return;
    }
    log.toggle();
  };
  return renderRow({
    ...(chain.state !== 'none'
      ? { footnote: 'Click to open the Debugger' }
      : log.isReadable
        ? { footnote: log.isShown ? 'Click to hide the log' : 'Click to read the log' }
        : {}),
    ...(chain.state === 'none' && log.isReadable && { isExpanded: isLogInline }),
    ...(isLogInline && { controlsId: logId }),
    onOpen: openRow,
    work: isLogInline ? (
      <CheckLogInline
        id={logId}
        sessionId={sessionId}
        url={check.detailsUrl ?? url}
        reading={log.reading}
      />
    ) : workState === null ? null : (
      <div className="flex min-w-0 flex-col gap-2">
        <AnalyzedCheckWork
          sessionId={sessionId}
          chain={chain}
          state={workState}
          detail={result?.detail ?? null}
        />
        {!isProposalShown || analysis === null || proposal === null ? null : (
          <CheckProposalInline
            sessionId={sessionId}
            hintScope={hintScope}
            checkName={check.name}
            finding={analysis.finding}
            proposal={proposal}
            options={analysis.options}
            isStarting={isFixStarting}
            onStart={startFix}
            onDismiss={() => {
              if (chain.debugger !== null) {
                dismissCheckProposal({ sessionId, agentId: chain.debugger.id });
              }
              setIsReviewOpen(false);
            }}
          />
        )}
      </div>
    ),
    isAgentWorking: workState === 'analyzing' || workState === 'fixing',
    action: isDrawerOpen ? null : (
      <CheckResultAction
        action={settled === null ? 'none' : resultOf({ state: settled }).action}
        lock={lock}
        analyzeTooltip={`Start a Debugger on this failure with ${modelLabel(routing.model, routing.provider)} at ${routing.effort} effort`}
        isAnalyzeStarting={isAnalyzeStarting}
        isFixStarting={isFixStarting}
        isPushing={checkFixPush.isPushing}
        isReviewOpen={isProposalShown}
        onAnalyze={analyze}
        onToggleReview={() => setIsReviewOpen((isOpen) => !isOpen)}
        onPush={() => void checkFixPush.push()}
        onRetryFix={() => startFix({ optionKey: undefined })}
      />
    ),
    hint: (
      <CheckAnalysisHint
        sessionId={sessionId}
        mountId={mountId}
        pullRequestUrl={pullRequest.url}
        check={check}
      />
    ),
  });
};

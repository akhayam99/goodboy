import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, ICON_SIZE, Tooltip } from '@goodboy/ui';
import type {
  MountId,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openLink } from '../../open/openLink';
import { useAppStore } from '../../../store';
import { captureStartHint } from '../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { usePendingAction } from '../../../shared/hooks/usePendingAction';
import { modelLabel } from '../../chat/utils/chat-constants';
import { analyzeFailingChecks } from '../checks/analyzeFailingChecks';
import { checkItemWorkStateOf } from '../checks/checkItemWorkStateOf';
import { checkRoutingOf } from '../checks/checkRoutingOf';
import { useCheckChain } from '../hooks/useCheckChain';
import { useCheckWorkLock } from '../hooks/useCheckWorkLock';
import { AnalyzedCheckWork } from './AnalyzedCheckWork';
import { CheckAnalysisHint } from './CheckAnalysisHint';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly pullRequest: PullRequestState | PullRequestView;
  readonly check: PrCheckRun;
  readonly renderRow: RenderRow;
};

type RowParts = {
  readonly footnote?: string;
  readonly work: ReactNode;
  readonly isAgentWorking: boolean;
  readonly action: ReactNode;
  readonly hint: ReactNode;
  readonly onOpen: () => void;
};

type RenderRow = (parts: RowParts) => ReactNode;

export const AnalyzedCheckRow = ({ sessionId, mountId, pullRequest, check, renderRow }: Props) => {
  const url = check.detailsUrl ?? pullRequest.url;
  const { chain } = useCheckChain({ sessionId, mountId, url });
  const lock = useCheckWorkLock({ sessionId, mountId });
  const routing = useAppStore(useShallow((state) => checkRoutingOf({ state, sessionId, mountId })));
  const openDrawer = useAppStore((state) => state.openDrawer);
  const isDrawerOpen = useAppStore(
    (state) =>
      state.drawer?.kind === 'check-analysis' &&
      state.drawer.payload.mountId === mountId &&
      state.drawer.payload.checkUrl === url,
  );
  const pending = usePendingAction({ sessionId });
  const analyzeKey = `check.analyze:${mountId}:${url}`;
  const isStarting = pending.pendingKeys.has(analyzeKey);
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
  const openAnalysis = (): void =>
    openDrawer({
      kind: 'check-analysis',
      sessionId,
      payload: { sessionId, mountId, checkUrl: url },
    });
  const workState = checkItemWorkStateOf({
    chain: chain.state,
    fixStatus: chain.fix?.status ?? null,
    isStarting,
  });
  const isAgentWorking = workState === 'analyzing' || workState === 'fixing';
  const canAnalyze = (chain.state === 'none' || chain.state === 'no-fix') && !isDrawerOpen;
  const AgentsIcon = CONCEPT_ICONS.agents;
  return renderRow({
    ...(chain.state === 'none' ? {} : { footnote: 'Click to open the Debugger' }),
    onOpen: chain.state === 'none' ? () => openLink({ url, sessionId }) : openAnalysis,
    work:
      workState === null ? null : (
        <AnalyzedCheckWork sessionId={sessionId} chain={chain} state={workState} />
      ),
    isAgentWorking,
    action: canAnalyze ? (
      <Tooltip
        content={
          lock ??
          `Start a Debugger on this failure with ${modelLabel(routing.model, routing.provider)} at ${routing.effort} effort`
        }
      >
        <Button
          variant="ghost"
          size="sm"
          isBusy={isStarting}
          disabled={lock !== null}
          onClick={analyze}
        >
          <AgentsIcon size={ICON_SIZE.row} aria-hidden />
          {chain.state === 'none' ? 'Analyze' : 'Analyze again'}
        </Button>
      </Tooltip>
    ) : null,
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

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, StatusDot, Tooltip } from '@goodboy/ui';
import type {
  MountId,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';
import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import { captureStartHint } from '../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { modelLabel } from '../../chat/utils/chat-constants';
import { analyzeFailingChecks } from '../checks/analyzeFailingChecks';
import { checkRoutingOf } from '../checks/checkRoutingOf';
import { useCheckChain } from '../hooks/useCheckChain';
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
  readonly status: ReactNode;
  readonly action: ReactNode;
  readonly hint: ReactNode;
  readonly onOpen: () => void;
};

type RenderRow = (parts: RowParts) => ReactNode;

type ChainState = Exclude<CheckChainState, 'none'>;

const WORDS: Readonly<Record<ChainState, string>> = {
  analyzing: 'Analyzing',
  proposal: 'Fix proposed',
  fixing: 'Fixing',
  'fixed-local': 'Not pushed',
  'fixed-pushed': 'Re-running',
  'fix-failed': 'Fix stopped',
  'no-fix': 'No fix found',
};

const TONES = {
  analyzing: 'info',
  fixing: 'info',
  proposal: 'warning',
  'fixed-local': 'warning',
  'fixed-pushed': 'info',
  'fix-failed': 'danger',
  'no-fix': 'neutral',
} as const satisfies Record<ChainState, string>;

const LIVE: ReadonlySet<ChainState> = new Set<ChainState>(['analyzing', 'fixing', 'fixed-pushed']);

export const AnalyzedCheckRow = ({ sessionId, mountId, pullRequest, check, renderRow }: Props) => {
  const url = check.detailsUrl ?? pullRequest.url;
  const { chain } = useCheckChain({ sessionId, mountId, url });
  const routing = useAppStore(useShallow((state) => checkRoutingOf({ state, sessionId, mountId })));
  const reportError = useAppStore((state) => state.reportError);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const isDrawerOpen = useAppStore(
    (state) =>
      state.drawer?.kind === 'check-analysis' &&
      state.drawer.payload.mountId === mountId &&
      state.drawer.payload.checkUrl === url,
  );
  const [isStarting, setIsStarting] = useState(false);
  const analyze = async (): Promise<void> => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      const state = useAppStore.getState();
      const capture =
        chain.state === 'none'
          ? null
          : captureStartHint({
              state,
              sessionId,
              scope: START_HINT_SCOPES.checkAnalyze({ mountId, url }),
            });
      await analyzeFailingChecks({
        sessionId,
        mountId,
        pullRequest,
        checks: [check],
        ...(capture !== null && {
          hint: capture.text,
          onAccepted: () => state.settleStartHint({ capture }),
        }),
      });
    } catch (error: unknown) {
      if (!isReportedError(error)) {
        void reportError({ title: "Couldn't start the Debugger", error, sessionId });
      }
    } finally {
      setIsStarting(false);
    }
  };
  const openAnalysis = (): void =>
    openDrawer({
      kind: 'check-analysis',
      sessionId,
      payload: { sessionId, mountId, checkUrl: url },
    });
  const canAnalyze = (chain.state === 'none' || chain.state === 'no-fix') && !isDrawerOpen;
  const AgentsIcon = CONCEPT_ICONS.agents;
  return renderRow({
    ...(chain.state === 'none' ? {} : { footnote: 'Click to open the Debugger' }),
    onOpen: chain.state === 'none' ? () => void openUrl(url) : openAnalysis,
    status:
      chain.state === 'none' ? null : (
        <>
          <StatusDot tone={TONES[chain.state]} pulsing={LIVE.has(chain.state)} size="sm" />
          <span role="status" className="text-meta text-muted-foreground">
            {WORDS[chain.state]}
          </span>
        </>
      ),
    action: canAnalyze ? (
      <Tooltip
        content={`Start a Debugger on this failure with ${modelLabel(routing.model, routing.provider)} at ${routing.effort} effort`}
      >
        <Button variant="ghost" size="sm" disabled={isStarting} onClick={() => void analyze()}>
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

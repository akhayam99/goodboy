import { useState } from 'react';
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
import { useKindRouting } from '../../../shared/hooks/useKindRouting';
import { useAppStore } from '../../../store';
import type { CheckChainState } from '../../../store/slices/agents/selectCheckChain';
import { isReportedError } from '../../../store/slices/notifications/reportedError';
import { modelLabel } from '../../chat/utils/chat-constants';
import { analyzeFailingChecks } from '../checks/analyzeFailingChecks';
import { checkRoutingOf } from '../checks/checkRoutingOf';
import { startCheckFix } from '../checks/startCheckFix';
import { useCheckChain } from '../hooks/useCheckChain';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly pullRequest: PullRequestState | PullRequestView;
  readonly check: PrCheckRun;
};

const WORDS: Readonly<Record<Exclude<CheckChainState, 'none'>, string>> = {
  analyzing: 'Debugger is analyzing',
  proposal: 'Debugger proposes a fix',
  fixing: 'Implementer is fixing',
  'fixed-local': 'Fixed, not pushed',
  'fixed-pushed': 'Pushed, re-running',
  'fix-failed': 'The fix stopped',
  'no-fix': 'Debugger found no fix',
};

const TONES = {
  analyzing: 'warning',
  fixing: 'warning',
  proposal: 'success',
  'fixed-local': 'warning',
  'fixed-pushed': 'success',
  'fix-failed': 'danger',
  'no-fix': 'neutral',
} as const satisfies Record<Exclude<CheckChainState, 'none'>, string>;

export const CheckAnalysisActions = ({ sessionId, mountId, pullRequest, check }: Props) => {
  const url = check.detailsUrl ?? pullRequest.url;
  const { chain } = useCheckChain({ sessionId, mountId, url });
  const routing = useAppStore(useShallow((state) => checkRoutingOf({ state, sessionId, mountId })));
  const fixRouting = useKindRouting({ sessionId, kind: 'implementer' });
  const reportError = useAppStore((state) => state.reportError);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const [isStarting, setIsStarting] = useState(false);
  const run = async ({
    title,
    task,
  }: {
    readonly title: string;
    readonly task: () => Promise<unknown>;
  }) => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await task();
    } catch (error: unknown) {
      if (!isReportedError(error)) {
        void reportError({ title, error, sessionId });
      }
    } finally {
      setIsStarting(false);
    }
  };
  const AgentsIcon = CONCEPT_ICONS.agents;
  const canAnalyze = chain.state === 'none' || chain.state === 'no-fix';
  return (
    <div className="flex shrink-0 items-center gap-2">
      {chain.state === 'none' ? null : (
        <>
          <StatusDot
            tone={TONES[chain.state]}
            pulsing={
              chain.state === 'analyzing' ||
              chain.state === 'fixing' ||
              chain.state === 'fixed-pushed'
            }
            size="sm"
          />
          <span role="status" className="text-meta text-muted-foreground">
            {WORDS[chain.state]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              openDrawer({
                kind: 'check-analysis',
                sessionId,
                payload: { sessionId, mountId, checkUrl: url },
              })
            }
          >
            Open
          </Button>
        </>
      )}
      {chain.state === 'proposal' ? (
        <Tooltip
          content={`Start an Implementer with this proposal: ${modelLabel(fixRouting.model, fixRouting.provider)} · ${fixRouting.effort}`}
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={isStarting}
            onClick={() =>
              void run({
                title: "Couldn't start the Implementer",
                task: () => startCheckFix({ sessionId, url, mountId }),
              })
            }
          >
            Start fix
          </Button>
        </Tooltip>
      ) : null}
      {canAnalyze ? (
        <Tooltip
          content={`Start a Debugger on this failure: ${modelLabel(routing.model, routing.provider)} · ${routing.effort}`}
        >
          <Button
            variant={chain.state === 'none' ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isStarting}
            onClick={() =>
              void run({
                title: "Couldn't start the Debugger",
                task: () =>
                  analyzeFailingChecks({ sessionId, mountId, pullRequest, checks: [check] }),
              })
            }
          >
            <AgentsIcon size={ICON_SIZE.row} aria-hidden />
            {chain.state === 'none' ? 'Analyze' : 'Analyze again'}
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
};

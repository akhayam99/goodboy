import { useState } from 'react';
import { Bug } from 'lucide-react';
import { Button, DrawerFrame, HeaderActions } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { captureStartHint } from '../../../../store/slices/startHints/captureStartHint';
import { START_HINT_SCOPES } from '../../../../store/slices/startHints/startHintScopes';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';
import { routingShortText } from '../../../../shared/components/RoutingPicker/routingSummary';
import { checkAnalysisOf } from '../../checks/checkAnalysisOf';
import { analyzedCheckNameOf } from '../../checks/analyzedCheckNameOf';
import { checkNameOf } from '../../checks/checkNameOf';
import { checkOutcomeOf } from '../../checks/checkOutcomeOf';
import { ciFixOutcomeOf } from '../../checks/ciFixOutcomeOf';
import { ciFixStepsOf } from '../../checks/ciFixStepsOf';
import { sectionOf } from '../../checks/sectionOf';
import { startCheckFix } from '../../checks/startCheckFix';
import { useCheckChain } from '../../hooks/useCheckChain';
import { useCheckFixPush } from '../../hooks/useCheckFixPush';
import { RevealedMarkdown } from '../../../chat/reveal/RevealedMarkdown';
import { agentLiveKey } from '../../../chat/reveal/agentLiveKey';
import { useFreshLanding } from '../../../chat/reveal/useFreshLanding';
import { AnalysisHeader } from './AnalysisHeader';
import { CiFixSteps } from './CiFixSteps';
import { DrawerSection } from './DrawerSection';
import { FailedLogs } from './FailedLogs';
import { GivenFacts } from './GivenFacts';
import { ProposedFix, type StartParams } from './ProposedFix';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly checkUrl: string;
  readonly onClose: () => void;
};

const FINDING_ITEM_KEY = 'finding';

export const CheckAnalysisDrawer = ({ sessionId, mountId, checkUrl, onClose }: Props) => {
  const { chain, events, turnState } = useCheckChain({ sessionId, mountId, url: checkUrl });
  const agent = chain.debugger;
  const fixRouting = useKindRouting({ sessionId, kind: 'implementer' });
  const dismissCheckProposal = useAppStore((state) => state.dismissCheckProposal);
  const reportError = useAppStore((state) => state.reportError);
  const checkFixPush = useCheckFixPush({ sessionId, mountId, fixAgentId: chain.fix?.id });
  const [isStarting, setIsStarting] = useState(false);
  const hintScope = START_HINT_SCOPES.checkFix({ mountId, url: checkUrl });
  const startFix = async ({ optionKey }: StartParams) => {
    if (isStarting) {
      return;
    }
    const state = useAppStore.getState();
    const capture = captureStartHint({ state, sessionId, scope: hintScope });
    setIsStarting(true);
    try {
      await startCheckFix({
        sessionId,
        url: checkUrl,
        mountId,
        hint: capture.text,
        onAccepted: () => state.settleStartHint({ capture }),
        ...(optionKey !== undefined && { optionKey }),
      });
    } catch (error: unknown) {
      if (!isReportedError(error)) {
        void reportError({ title: "Couldn't start the Implementer", error, sessionId });
      }
    } finally {
      setIsStarting(false);
    }
  };
  const analysis =
    agent === null ? null : checkAnalysisOf({ agent, events: events ?? [], turnState });
  const kickoff = analysis?.kickoff ?? '';
  const liveKey = agent === null ? '' : agentLiveKey({ agentId: agent.id });
  const proposalLanding = useFreshLanding({ liveKey, text: analysis?.proposal ?? '' });
  const given = sectionOf({ text: kickoff, heading: 'What it was given' })?.body ?? null;
  const log = sectionOf({ text: kickoff, heading: 'Failed log tail' })?.body ?? null;
  const urlName = useAppStore((state) => checkNameOf({ state, mountId, url: checkUrl }));
  const checkName = analyzedCheckNameOf({ events: events ?? [] }) ?? urlName;
  const checkOutcome = useAppStore((state) =>
    checkOutcomeOf({
      checks: state.mountGithub[mountId]?.detail?.checks ?? [],
      name: checkName,
      analyzedUrl: checkUrl,
    }),
  );
  const hasFixLanded = chain.state === 'fixed-local' || chain.state === 'fixed-pushed';
  const outcome = ciFixOutcomeOf({
    state: chain.state,
    commit: chain.commit,
    checkName,
    checkOutcome,
    isDismissed: chain.isDismissed,
  });
  const pushAction =
    chain.state === 'fixed-local' ? (
      <HeaderActions
        primary={
          <Button
            variant="primary"
            size="sm"
            isBusy={checkFixPush.isPushing}
            busyLabel="Pushing"
            onClick={() => void checkFixPush.push()}
          >
            Push
          </Button>
        }
      />
    ) : undefined;
  return (
    <DrawerFrame title="Debugger" icon={Bug} action={pushAction} onClose={onClose}>
      {agent === null || analysis === null ? (
        <p className="text-body text-muted-foreground">This analysis is no longer available.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-6">
          <AnalysisHeader
            agent={agent}
            isRunning={analysis.isRunning}
            activity={analysis.activity}
            outcome={outcome}
          />
          <CiFixSteps
            sessionId={sessionId}
            steps={ciFixStepsOf({ chain, checkName, checkOutcome })}
          />
          <DrawerSection label="Finding" isCollapsible={hasFixLanded}>
            {analysis.finding.length > 0 ? (
              <RevealedMarkdown
                liveKey={liveKey}
                itemKey={FINDING_ITEM_KEY}
                text={analysis.finding}
                isComplete={!analysis.isRunning}
              />
            ) : (
              <p className="text-body text-muted-foreground">Waiting for the Debugger's finding.</p>
            )}
          </DrawerSection>
          <DrawerSection label="Proposed fix" isCollapsible={hasFixLanded}>
            {analysis.proposal === null ? (
              <p className="text-body text-muted-foreground">
                {analysis.isRunning
                  ? 'The Debugger is still investigating.'
                  : 'No fix was proposed.'}
              </p>
            ) : (
              <div
                key={proposalLanding.fadeKey}
                className="flex min-w-0 flex-col gap-3"
                {...proposalLanding.fade}
              >
                <ProposedFix
                  sessionId={sessionId}
                  hintScope={hintScope}
                  proposal={analysis.proposal}
                  options={analysis.options}
                  isActionable={chain.state === 'proposal'}
                  isStarting={isStarting}
                  routing={routingShortText(fixRouting)}
                  onStart={(params) => void startFix(params)}
                  onDismiss={() => dismissCheckProposal({ sessionId, agentId: agent.id })}
                />
              </div>
            )}
          </DrawerSection>
          <DrawerSection label="What it was given" isCollapsible>
            {given === null ? (
              <p className="text-body text-muted-foreground">The kickoff is not available.</p>
            ) : (
              <GivenFacts text={given} />
            )}
          </DrawerSection>
          <DrawerSection label="Failed log tail" isCollapsible>
            <FailedLogs text={log} />
          </DrawerSection>
        </div>
      )}
    </DrawerFrame>
  );
};

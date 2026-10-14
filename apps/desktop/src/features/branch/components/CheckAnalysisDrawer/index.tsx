import { useState } from 'react';
import { Bug } from 'lucide-react';
import { DrawerFrame, Markdown } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { AgentChain } from '../../../../shared/components/AgentChain';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';
import { routingShortText } from '../../../../shared/components/RoutingPicker/routingSummary';
import { checkAnalysisOf } from '../../checks/checkAnalysisOf';
import { analyzedCheckNameOf } from '../../checks/analyzedCheckNameOf';
import { checkNameOf } from '../../checks/checkNameOf';
import { checkOutcomeOf } from '../../checks/checkOutcomeOf';
import { fixOutcomeText } from '../../checks/fixOutcomeText';
import { sectionOf } from '../../checks/sectionOf';
import { startCheckFix } from '../../checks/startCheckFix';
import { useCheckChain } from '../../hooks/useCheckChain';
import { AnalysisHeader } from './AnalysisHeader';
import { DrawerBox } from './DrawerBox';
import { FailedLogBox } from './FailedLogBox';
import { GivenBox } from './GivenBox';
import { ProposedFix, type StartParams } from './ProposedFix';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly checkUrl: string;
  readonly onClose: () => void;
};

export const CheckAnalysisDrawer = ({ sessionId, mountId, checkUrl, onClose }: Props) => {
  const { chain, events, turnState } = useCheckChain({ sessionId, mountId, url: checkUrl });
  const agent = chain.debugger;
  const fixRouting = useKindRouting({ sessionId, kind: 'implementer' });
  const dismissCheckProposal = useAppStore((state) => state.dismissCheckProposal);
  const reportError = useAppStore((state) => state.reportError);
  const [isStarting, setIsStarting] = useState(false);
  const startFix = async ({ optionKey }: StartParams) => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await startCheckFix({
        sessionId,
        url: checkUrl,
        mountId,
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
  const isPushed = chain.state === 'fixed-pushed';
  const hasFixLanded = chain.state === 'fixed-local' || isPushed;
  const outcome =
    fixOutcomeText({ state: chain.state, commit: chain.commit, checkName }) ??
    (chain.isDismissed ? 'Dismissed. Analyze again for another proposal.' : null);
  return (
    <DrawerFrame title="Debugger" icon={Bug} onClose={onClose}>
      {agent === null || analysis === null ? (
        <p className="text-body text-muted-foreground">This analysis is no longer available.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <AnalysisHeader
            sessionId={sessionId}
            agent={agent}
            isRunning={analysis.isRunning}
            activity={analysis.activity}
          />
          <DrawerBox label="Finding">
            {analysis.finding.length > 0 ? (
              <Markdown text={analysis.finding} />
            ) : (
              <p className="text-body text-muted-foreground">Waiting for the Debugger's finding.</p>
            )}
          </DrawerBox>
          {analysis.proposal === null ? (
            <DrawerBox label="Proposed fix">
              <p className="text-body text-muted-foreground">
                {analysis.isRunning
                  ? 'The Debugger is still investigating.'
                  : 'No fix was proposed.'}
              </p>
            </DrawerBox>
          ) : (
            <>
              <ProposedFix
                proposal={analysis.proposal}
                options={analysis.options}
                isActionable={chain.state === 'proposal'}
                isStarting={isStarting}
                routing={routingShortText(fixRouting)}
                outcome={outcome}
                onStart={(params) => void startFix(params)}
                onDismiss={() => dismissCheckProposal({ sessionId, agentId: agent.id })}
              />
              <DrawerBox label="Activity">
                <AgentChain
                  sessionId={sessionId}
                  steps={[
                    hasFixLanded
                      ? {
                          name: 'Analyze',
                          agent: null,
                          isRunning: false,
                          detail: 'Done',
                          tone: 'success',
                        }
                      : {
                          name: 'Proposal',
                          agent: null,
                          isRunning: false,
                          detail: chain.isDismissed
                            ? 'Dismissed'
                            : chain.fix === null
                              ? 'Waiting for you'
                              : 'Accepted',
                          tone: chain.fix === null && !chain.isDismissed ? 'warning' : 'neutral',
                        },
                    {
                      name: 'Fix',
                      agent: chain.fix,
                      isRunning: chain.state === 'fixing',
                      ...(chain.fix === null && { detail: 'Not started' }),
                      ...(hasFixLanded && { detail: 'Done', tone: 'success' as const }),
                      ...(chain.fix === null && { tone: 'neutral' as const }),
                    },
                    ...(hasFixLanded
                      ? [
                          isPushed
                            ? {
                                name: 'Push',
                                agent: null,
                                isRunning: false,
                                detail: 'Done',
                                tone: 'success' as const,
                              }
                            : {
                                name: 'Push',
                                agent: null,
                                isRunning: false,
                                detail: 'Needs you',
                                tone: 'warning' as const,
                              },
                        ]
                      : []),
                    ...(isPushed
                      ? [
                          {
                            name: checkName ?? 'Check',
                            agent: null,
                            isRunning: checkOutcome === 'running',
                            detail:
                              checkOutcome === 'running'
                                ? 'Running'
                                : checkOutcome === 'passed'
                                  ? 'Passed'
                                  : 'Still failing',
                            tone:
                              checkOutcome === 'passed'
                                ? ('success' as const)
                                : checkOutcome === 'failed'
                                  ? ('danger' as const)
                                  : ('warning' as const),
                          },
                        ]
                      : []),
                  ]}
                />
              </DrawerBox>
            </>
          )}
          {given === null ? (
            <DrawerBox label="What it was given">
              <p className="text-body text-muted-foreground">The kickoff is not available.</p>
            </DrawerBox>
          ) : (
            <GivenBox text={given} />
          )}
          <FailedLogBox text={log} />
        </div>
      )}
    </DrawerFrame>
  );
};

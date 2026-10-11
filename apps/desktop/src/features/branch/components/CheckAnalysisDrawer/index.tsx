import { useState } from 'react';
import { Bug } from 'lucide-react';
import { Button, Chip, DrawerFrame, Markdown, SectionHeader, ScrollFade } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { AgentChain } from '../../../../shared/components/AgentChain';
import { useKindRouting } from '../../../../shared/hooks/useKindRouting';
import { routingShortText } from '../../../../shared/components/RoutingPicker/routingSummary';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { checkAnalysisOf } from '../../checks/checkAnalysisOf';
import { sectionOf } from '../../checks/sectionOf';
import { startCheckFix } from '../../checks/startCheckFix';
import { useCheckChain } from '../../hooks/useCheckChain';
import { Proposal } from './Proposal';

type Props = {
  readonly sessionId: SessionId;
  readonly checkUrl: string;
  readonly onClose: () => void;
};

export const CheckAnalysisDrawer = ({ sessionId, checkUrl, onClose }: Props) => {
  const { chain, events, turnState } = useCheckChain({ sessionId, url: checkUrl });
  const agent = chain.debugger;
  const fixRouting = useKindRouting({ sessionId, kind: 'implementer' });
  const dismissCheckProposal = useAppStore((state) => state.dismissCheckProposal);
  const reportError = useAppStore((state) => state.reportError);
  const [isStarting, setIsStarting] = useState(false);
  const startFix = async () => {
    if (isStarting) {
      return;
    }
    setIsStarting(true);
    try {
      await startCheckFix({ sessionId, url: checkUrl });
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
  const given =
    sectionOf({ text: analysis?.kickoff ?? '', heading: 'What it was given' })?.body ??
    'The kickoff is not available.';
  const log =
    sectionOf({ text: analysis?.kickoff ?? '', heading: 'Failed log tail' })?.body ??
    'Not readable here';
  const finding =
    sectionOf({ text: analysis?.text ?? '', heading: 'Proposed fix' })?.before ??
    analysis?.text ??
    '';
  const outcome =
    chain.state === 'fixing'
      ? 'Implementer is applying it on the branch.'
      : chain.state === 'fixed'
        ? chain.commit === null
          ? 'Applied on the branch. The check runs again.'
          : `Applied and committed ${chain.commit} on the branch. The check runs again.`
        : chain.state === 'fix-failed'
          ? 'The fix stopped. Open the Implementer to see why.'
          : chain.isDismissed
            ? 'Dismissed. Analyze again for another proposal.'
            : null;
  const checkName =
    given
      .split('\n')
      .find((line) => line.startsWith('Check: '))
      ?.slice(7) ?? 'failed checks';
  return (
    <DrawerFrame
      title="Debugger"
      icon={Bug}
      count={
        agent?.modelOverride === undefined ? null : (
          <Chip tone="neutral" label={modelLabel(agent.modelOverride, agent.providerOverride)} />
        )
      }
      onClose={onClose}
    >
      {agent === null || analysis === null ? (
        <p className="text-body text-muted-foreground">This analysis is no longer available.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label="Activity" />
            <AgentChain
              sessionId={sessionId}
              steps={[
                { name: `Analyze ${checkName}`, agent, isRunning: analysis.isRunning },
                ...(analysis.proposal === null
                  ? []
                  : [
                      {
                        name: 'Proposal',
                        agent: null,
                        isRunning: false,
                        detail: chain.isDismissed
                          ? 'Dismissed'
                          : chain.fix === null
                            ? 'Waiting for you'
                            : 'Accepted',
                        tone: chain.fix === null && !chain.isDismissed ? 'warning' : 'neutral',
                      } as const,
                      {
                        name: 'Fix',
                        agent: chain.fix,
                        isRunning: chain.state === 'fixing',
                        ...(chain.fix === null && { detail: 'Not started' }),
                        ...(chain.state === 'fixed' &&
                          chain.commit !== null && { detail: `Committed ${chain.commit}` }),
                        ...(chain.fix === null && { tone: 'neutral' as const }),
                      },
                    ]),
              ]}
            />
          </section>
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label="Status" />
            <p role="status" className="text-body text-muted-foreground">
              {analysis.isRunning ? analysis.activity : analysis.label}
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label="Finding" />
            {finding.length > 0 ? (
              <Markdown text={finding} />
            ) : (
              <p className="text-body text-muted-foreground">Waiting for the Debugger's finding.</p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label="Proposed fix" />
            {analysis.proposal === null ? (
              <p className="text-body text-muted-foreground">
                {analysis.isRunning
                  ? 'The Debugger is still investigating.'
                  : 'No fix was proposed.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <Proposal text={analysis.proposal} />
                {chain.state === 'proposal' ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={isStarting}
                      onClick={() => void startFix()}
                    >
                      Start fix
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissCheckProposal({ sessionId, agentId: agent.id })}
                    >
                      Dismiss
                    </Button>
                    <span className="text-meta text-faint-foreground">
                      Implementer · {routingShortText(fixRouting)}
                    </span>
                  </div>
                ) : null}
                {outcome === null ? null : (
                  <p role="status" className="text-body text-muted-foreground">
                    {outcome}
                  </p>
                )}
              </div>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label="What it was given" />
            <Markdown text={given} />
          </section>
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label="Failed log tail" />
            <ScrollFade className="max-h-64">
              <Markdown text={log} />
            </ScrollFade>
          </section>
        </div>
      )}
    </DrawerFrame>
  );
};

import { useEffect } from 'react';
import { Bug } from 'lucide-react';
import { Chip, DrawerFrame, Markdown, SectionHeader, ScrollFade } from '@goodboy/ui';
import type { SessionId, TurnEvent } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectCheckAnalysis } from '../../../../store/slices/agents/selectCheckAnalysis';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { AgentChain } from '../../../../shared/components/AgentChain';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { checkAnalysisOf } from '../../checks/checkAnalysisOf';
import { sectionOf } from '../../checks/sectionOf';
import { Proposal } from './Proposal';

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly checkUrl: string;
  readonly onClose: () => void;
};

export const CheckAnalysisDrawer = ({ sessionId, checkUrl, onClose }: Props) => {
  const agent = useAppStore((state) => selectCheckAnalysis({ state, sessionId, url: checkUrl }));
  const events = useAppStore((state) =>
    agent === null ? NO_EVENTS : (state.transcripts[agent.id] ?? NO_EVENTS),
  );
  const turnState = useAppStore((state) =>
    agent === null ? undefined : state.agentTurnState[agent.id],
  );
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const reportError = useAppStore((state) => state.reportError);
  const hasTranscript = useAppStore(
    (state) => agent !== null && state.transcripts[agent.id] !== undefined,
  );
  useEffect(() => {
    if (agent === null || hasTranscript) {
      return;
    }
    void loadAgentTranscript(sessionId, agent.id, { isSelecting: false }).catch(
      (error: unknown) => {
        if (!isReportedError(error)) {
          void reportError({ title: "Couldn't read the analysis", error, sessionId });
        }
      },
    );
  }, [agent, hasTranscript, loadAgentTranscript, reportError, sessionId]);
  const analysis = agent === null ? null : checkAnalysisOf({ agent, events, turnState });
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
              steps={[{ name: `Analyze ${checkName}`, agent, isRunning: analysis.isRunning }]}
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
              <Proposal text={analysis.proposal} />
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

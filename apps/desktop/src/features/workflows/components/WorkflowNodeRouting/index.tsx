import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Divider } from '@goodboy/ui';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { Agent, ProviderId, SessionId, Step, WorkflowRunId } from '@goodboy/types';
import type { ProviderInfo } from '../../../providers/providers';
import { useAppStore } from '../../../../store/store';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { WorkflowNodeRoutingRow } from './WorkflowNodeRoutingRow';

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_PROVIDERS: ReadonlyArray<ProviderInfo> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly steps: ReadonlyArray<Step>;
};

export const WorkflowNodeRouting = ({ sessionId, workflowRunId, steps }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const sessionAgents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const providers = useAppStore((state) => state.providers ?? EMPTY_PROVIDERS);
  const nodes = useMemo(
    () =>
      sessionAgents
        .filter((agent) => agent.workflowRunId === workflowRunId)
        .sort((left, right) => left.ordinal - right.ordinal),
    [sessionAgents, workflowRunId],
  );
  const connectedProviders = useMemo<ReadonlyArray<ProviderId>>(
    () =>
      providers
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id)
        .filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0),
    [providers],
  );
  if (nodes.length === 0) {
    return null;
  }
  const summary = nodes.length === 1 ? '1 model choice' : `${String(nodes.length)} model choices`;

  return (
    <>
      <Divider />
      <section
        data-testid="workflow-node-routing"
        aria-label={WORKFLOW_ROUTING_COPY.sectionLabel}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => open === false)}
          className="flex items-center gap-1 self-start rounded-md text-2xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {isOpen ? (
            <ChevronDown size={11} aria-hidden className="shrink-0" />
          ) : (
            <ChevronRight size={11} aria-hidden className="shrink-0" />
          )}
          {summary}
        </button>
        {isOpen ? (
          <>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {WORKFLOW_ROUTING_COPY.sectionHint}
            </p>
            <ul className="flex min-w-0 flex-col gap-1.5">
              {nodes.map((agent) => (
                <WorkflowNodeRoutingRow
                  key={agent.id}
                  sessionId={sessionId}
                  agent={agent}
                  step={steps.find((candidate) => candidate.id === agent.stepId) ?? null}
                  connectedProviders={connectedProviders}
                />
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </>
  );
};

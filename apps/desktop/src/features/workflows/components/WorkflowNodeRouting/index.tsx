import { useMemo } from 'react';
import { X } from 'lucide-react';
import { IconButton, SectionSurface } from '@goodboy/ui';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { Agent, ProviderId, SessionId, Step, WorkflowRunId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../providers/providers';
import { useAppStore } from '../../../../store/store';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WorkflowNodeRoutingRow } from './WorkflowNodeRoutingRow';

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_PROVIDERS: ReadonlyArray<ProviderDisplayInfo> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly steps: ReadonlyArray<Step>;
  readonly onClose: () => void;
};

export const WorkflowNodeRouting = ({ sessionId, workflowRunId, steps, onClose }: Props) => {
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
  return (
    <SectionSurface
      label={WORKFLOW_ROUTING_COPY.sectionLabel}
      ariaLabel={WORKFLOW_ROUTING_COPY.sectionLabel}
      hint={WORKFLOW_ROUTING_COPY.sectionHint}
      action={
        <IconButton
          variant="ghost"
          icon={X}
          iconSize={ICON_SIZE.row}
          label={`Hide ${WORKFLOW_ROUTING_COPY.sectionLabel.toLowerCase()}`}
          onClick={onClose}
          className="size-6"
        />
      }
    >
      <ul data-testid="workflow-node-routing" className="flex min-w-0 flex-col gap-1.5">
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
    </SectionSurface>
  );
};

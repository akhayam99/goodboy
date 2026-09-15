import { useMemo, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { runsForWorkflowRun } from '@goodboy/core';
import { AnchoredPopover, Button, PopoverBody, cn, formatError, useDropdown } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  ARTIFACT_CTA_BLOCK_COPY,
  resolveArtifactCtaState,
} from '../../../artifacts/artifactCtaState';
import {
  WIREFRAME_FIDELITIES,
  WIREFRAME_FIDELITY_HINT,
  WIREFRAME_FIDELITY_LABEL,
  type WireframeFidelity,
} from '../../wireframeFidelity';
import { FidelityRow } from './FidelityRow';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly className?: string;
};

export const CreateWireframeCta = ({ sessionId, workflowRunId = null, className }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 200,
    expectedWidth: 288,
    width: 'w-72 max-w-[calc(100vw-2rem)]',
  });
  const { close, toggle } = dropdown;
  const [pending, setPending] = useState<WireframeFidelity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isSummarizerRunning = useAppStore(
    (state) => state.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const isTurnRunning = useAppStore((state) =>
    agents.some((agent) => {
      const turn = state.agentTurnState?.[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const spawnWireframeAgent = useAppStore((state) => state.spawnWireframeAgent);
  const runAgents = useMemo(
    () => (workflowRunId === null ? null : runsForWorkflowRun(agents, workflowRunId)),
    [agents, workflowRunId],
  );
  const state = resolveArtifactCtaState({
    agents,
    runAgents,
    isTurnRunning,
    isSummarizerRunning,
  });
  const isBlocked = state.kind === 'blocked';
  const blockCopy = state.kind === 'blocked' ? ARTIFACT_CTA_BLOCK_COPY[state.reason] : null;

  const create = async (fidelity: WireframeFidelity) => {
    if (pending !== null) {
      return;
    }
    setPending(fidelity);
    setError(null);
    try {
      await spawnWireframeAgent({ sessionId, fidelity, workflowRunId });
      close();
      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      setPending(null);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Create wireframe"
      className="flex flex-col bg-subtle"
      anchorClassName={cn('min-w-0', className)}
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={toggle}
          disabled={isBlocked}
          data-testid="create-wireframe-cta"
          title={blockCopy ?? 'Draft a navigable wireframe from what this session produced'}
        >
          <LayoutTemplate size={ICON_SIZE.row} aria-hidden />
          Create wireframe
        </Button>
      }
    >
      <PopoverBody className="flex flex-col gap-0.5 p-1">
        {WIREFRAME_FIDELITIES.map((fidelity) => (
          <FidelityRow
            key={fidelity}
            label={WIREFRAME_FIDELITY_LABEL[fidelity]}
            hint={WIREFRAME_FIDELITY_HINT[fidelity]}
            isBusy={pending === fidelity}
            isDisabled={pending !== null}
            onSelect={() => void create(fidelity)}
          />
        ))}
        {error === null ? null : (
          <span role="alert" className="px-2 py-1 text-2xs text-danger">
            {error}
          </span>
        )}
      </PopoverBody>
    </AnchoredPopover>
  );
};

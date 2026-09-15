import { useMemo, useState } from 'react';
import { runsForWorkflowRun } from '@goodboy/core';
import { AnchoredPopover, Button, PopoverBody, cn, formatError, useDropdown } from '@goodboy/ui';
import type { Agent, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REPORT_CTA_BLOCK_COPY, resolveReportCtaState } from '../../reportCtaState';
import {
  REPORT_TYPES,
  REPORT_TYPE_HINT,
  REPORT_TYPE_LABEL,
  type ReportType,
} from '../../reportTypes';
import { ReportTypeRow } from './ReportTypeRow';

type Props = {
  readonly sessionId: SessionId;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly className?: string;
};

export const CreateReportCta = ({ sessionId, workflowRunId = null, className }: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 200,
    expectedWidth: 288,
    width: 'w-72 max-w-[calc(100vw-2rem)]',
  });
  const { close, toggle } = dropdown;
  const [pending, setPending] = useState<ReportType | null>(null);
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
  const spawnReportAgent = useAppStore((state) => state.spawnReportAgent);
  const runAgents = useMemo(
    () => (workflowRunId === null ? null : runsForWorkflowRun(agents, workflowRunId)),
    [agents, workflowRunId],
  );
  const state = resolveReportCtaState({
    agents,
    runAgents,
    isTurnRunning,
    isSummarizerRunning,
  });
  const isBlocked = state.kind === 'blocked';
  const blockCopy = state.kind === 'blocked' ? REPORT_CTA_BLOCK_COPY[state.reason] : null;

  const create = async (reportType: ReportType) => {
    if (pending !== null) {
      return;
    }
    setPending(reportType);
    setError(null);
    try {
      await spawnReportAgent({ sessionId, reportType, workflowRunId });
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
      ariaLabel="Create report"
      className="flex flex-col bg-subtle"
      anchorClassName={cn('min-w-0', className)}
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={toggle}
          disabled={isBlocked}
          data-testid="create-report-cta"
          title={blockCopy ?? 'Synthesize a report from what this session produced'}
        >
          <CONCEPT_ICONS.changelog size={ICON_SIZE.row} aria-hidden />
          Create report
        </Button>
      }
    >
      <PopoverBody className="flex flex-col gap-0.5 p-1">
        {REPORT_TYPES.map((reportType) => (
          <ReportTypeRow
            key={reportType}
            label={REPORT_TYPE_LABEL[reportType]}
            hint={REPORT_TYPE_HINT[reportType]}
            isBusy={pending === reportType}
            isDisabled={pending !== null}
            onSelect={() => void create(reportType)}
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

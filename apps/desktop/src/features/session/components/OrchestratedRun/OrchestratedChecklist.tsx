import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SectionLabel } from '@goodboy/ui';
import { parseRunSummaryText } from '@goodboy/core';
import type { AgentId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { RunTree } from '../../../workflows/components/RunTree';
import type { RunTreeInsert } from '../../../workflows/runTreeInsert';
import { useRunTree } from '../../../workflows/components/RunTree/useRunTree';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { orchestratedChecklistOf } from '../../../workflows/orchestratedChecklistOf';
import type { AgentKind } from '../../agent-kind';
import type { RunView } from '../AgentTree/useRunView';
import { OrchestratedNotes } from './OrchestratedNotes';
import { OrchestratedHintRow } from './OrchestratedHintRow';
import { OrchestratedPlanRow } from './OrchestratedPlanRow';

type Props = {
  readonly session: Session;
  readonly view: RunView;
};

const CHECKLIST_EMPTY_SLOT = 28;

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

type AgentParams = {
  readonly agentId: AgentId;
};

export const OrchestratedChecklist = ({ session, view }: Props) => {
  const { run, workflow, agents } = view;
  const sessionId = session.id;
  const sectionRef = useRef<HTMLElement | null>(null);
  const roleModels = useSessionRoleModels({ sessionId });
  const openDrawer = useAppStore((state) => state.openDrawer);
  const openStepId = useAppStore((state) =>
    state.drawer?.kind === 'run-step' && state.drawer.payload.runId === run.id
      ? state.drawer.payload.agentId
      : null,
  );
  const agentKindOverride = useAppStore(
    useShallow((state) => {
      const overrides: Record<string, AgentKind> = {};
      for (const agent of agents) {
        const kind = state.agentKindOverride[agent.id];
        if (kind !== undefined) {
          overrides[agent.id] = kind;
        }
      }
      return overrides;
    }),
  );
  const tree = useRunTree({ session, run, workflow, agentKindOverride });
  const isDone = view.orchestrator.state.phase === 'done';
  const checklist = orchestratedChecklistOf({
    agents,
    hints: run.orchestratorHints ?? [],
    summary: parseRunSummaryText(run.orchestratorSummary?.trim() ?? ''),
    isDeciding: view.orchestrator.state.phase === 'deciding',
    isDone,
  });
  const stepCount = agents.filter((agent) => agent.parentAgentId == null).length;
  const skipped = (run.rulesSnapshot?.planChanges ?? []).filter(
    (change) => change.kind === 'skipped',
  );

  const openStep = ({ agentId }: AgentParams) => {
    const row = sectionRef.current?.querySelector<HTMLElement>(
      `[data-testid="run-tree-row-${agentId}"]`,
    );
    const target = row?.querySelector<HTMLElement>(FOCUSABLE);
    if (row == null || target == null) {
      openDrawer({ kind: 'run-step', sessionId, payload: { runId: run.id, agentId } });
      return;
    }
    row.scrollIntoView({ block: 'nearest' });
    target.focus();
  };

  const beforeRow = ({ agentId, slotWidth, ink, hasLineBelow }: RunTreeInsert) => {
    const hints = agentId === null ? [] : (checklist.readHintsBefore.get(agentId) ?? []);
    return hints.map((hint) => (
      <OrchestratedHintRow
        key={hint.id}
        hint={hint}
        sessionId={sessionId}
        runId={run.id}
        state="read"
        slotWidth={slotWidth}
        ink={ink}
        hasLineBelow={hasLineBelow}
        onOpenStep={agentId === null ? null : () => openStep({ agentId })}
      />
    ));
  };

  const trailing = ({ slotWidth, ink, hasLineBelow }: RunTreeInsert) => (
    <>
      {checklist.trailingHints.map((hint) => (
        <OrchestratedHintRow
          key={hint.id}
          hint={hint}
          sessionId={sessionId}
          runId={run.id}
          state="read"
          slotWidth={slotWidth}
          ink={ink}
          hasLineBelow={hasLineBelow}
        />
      ))}
      {checklist.isNextShown ? (
        <OrchestratedPlanRow kind="next" label={ORCHESTRATED_COPY.nextStep} slotWidth={slotWidth} />
      ) : null}
      {skipped.map((change) => (
        <OrchestratedPlanRow
          key={`skipped-${change.step}`}
          kind="skipped"
          label={ORCHESTRATED_COPY.skippedStep({ step: change.step, reason: change.reason })}
          slotWidth={slotWidth}
        />
      ))}
      {checklist.left.map((item) => (
        <OrchestratedPlanRow
          key={`left-${item.text}`}
          kind="left"
          label={item.text}
          role={item.role}
          slotWidth={slotWidth}
        />
      ))}
    </>
  );

  if (
    agents.length === 0 &&
    checklist.left.length === 0 &&
    checklist.notes.length === 0 &&
    skipped.length === 0 &&
    !checklist.isNextShown
  ) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      aria-label={ORCHESTRATED_COPY.checklist}
      className="flex min-w-0 flex-col gap-2"
    >
      <SectionLabel
        label={ORCHESTRATED_COPY.steps}
        headingLevel={2}
        count={stepCount === 0 ? undefined : stepCount}
      />
      {agents.length > 0 ? (
        <RunTree
          density="checklist"
          sessionId={sessionId}
          runId={run.id}
          tree={tree}
          routing={{
            stepById: new Map(workflow.steps.map((step) => [step.id, step])),
            roleModels,
            sessionProvider: session.providerPreference?.defaultProvider ?? null,
            sessionEffort: session.effort ?? null,
            run,
          }}
          selectedAgentId={openStepId}
          highlightedStepId={null}
          beforeRow={beforeRow}
          trailing={trailing}
          onHighlight={() => undefined}
          onSelect={(agentId) =>
            openDrawer({ kind: 'run-step', sessionId, payload: { runId: run.id, agentId } })
          }
          onAnswer={() => undefined}
        />
      ) : (
        trailing({ agentId: null, slotWidth: CHECKLIST_EMPTY_SLOT, ink: null, hasLineBelow: false })
      )}
      <OrchestratedNotes notes={checklist.notes} />
    </section>
  );
};

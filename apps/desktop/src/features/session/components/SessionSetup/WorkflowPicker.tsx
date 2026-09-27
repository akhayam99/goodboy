import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, Workflow } from '@goodboy/types';
import { useAppStore, useSessionSlots } from '../../../../store';
import { selectPresetWorkflows } from '../../../../store/slices/workflows/selectPresetWorkflows';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { builderDraftFor, type WorkflowStartChoice } from '../WorkflowBuilderView/builderDraftFor';
import { WorkflowPickerGroup, type WorkflowPickerRow } from './WorkflowPickerGroup';

type Props = {
  readonly session: Session;
};

const stepCount = ({ workflow }: { readonly workflow: Workflow }): string | null => {
  const count = workflow.steps.length;
  if (count === 0) {
    return null;
  }
  return count === 1 ? '1 step' : `${count} steps`;
};

export const WorkflowPicker = ({ session }: Props) => {
  const sessionId = session.id;
  const workspaceId = session.workspaceId;
  const workflows = useAppStore(
    useShallow((state) => selectPresetWorkflows({ state, workspaceId })),
  );
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const setWorkflowDraft = useAppStore((state) => state.setWorkflowDraft);
  const slots = useSessionSlots(sessionId);
  const goal = (slots.find((slot) => slot.key === 'goal')?.value ?? '').trim();

  useEffect(() => {
    void loadPhaseTemplates(workspaceId).catch(() => undefined);
  }, [loadPhaseTemplates, workspaceId]);

  const pick = (choice: WorkflowStartChoice) => {
    setWorkflowDraft(sessionId, builderDraftFor({ choice, goal }));
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  const presetRow = (workflow: Workflow): WorkflowPickerRow => ({
    key: workflow.id,
    name: workflow.name,
    line: workflow.description,
    meta: stepCount({ workflow }),
    icon: CONCEPT_ICONS.workflows,
    onPick: () => pick({ kind: 'preset', workflow }),
  });

  const scratch: ReadonlyArray<WorkflowPickerRow> = [
    {
      key: 'orchestrated',
      name: 'Orchestrated workflow',
      line: 'Goodboy picks each next step from the latest results.',
      meta: null,
      icon: CONCEPT_ICONS.orchestrator,
      onPick: () => pick({ kind: 'orchestrated' }),
    },
    {
      key: 'custom',
      name: 'Custom workflow',
      line: 'Write the steps yourself, or draft them with the planner.',
      meta: null,
      icon: CONCEPT_ICONS.plan,
      onPick: () => pick({ kind: 'custom' }),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <WorkflowPickerGroup
        label="Your workflows"
        rows={workflows.filter((workflow) => workflow.origin !== 'library').map(presetRow)}
      />
      <WorkflowPickerGroup
        label="Built in"
        rows={workflows.filter((workflow) => workflow.origin === 'library').map(presetRow)}
      />
      <WorkflowPickerGroup label="From scratch" rows={scratch} />
    </div>
  );
};

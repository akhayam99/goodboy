import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band, Switch } from '@goodboy/ui';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { WorkflowRulesPanel } from '../../../workflows/workflowRulesPanel';
import { AutoLevelDefaultRow } from './AutoLevelDefaultRow';
import { RunDefaultField } from './RunDefaultField';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type PersistParams = {
  readonly patch: WorkspaceOverridesPatch;
  readonly failureTitle: string;
};

export const WorkspaceDefaultsGrid = ({ workspaceId }: Props) => {
  const patchWorkspaceOverrides = useAppStore((s) => s.patchWorkspaceOverrides);
  const verbosity = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultVerbosity,
  );
  const parallelAgents = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).parallelAgents,
  );
  const reportError = useAppStore((s) => s.reportError);
  const [busy, setBusy] = useState(false);

  const persistOverrides = async ({ patch, failureTitle }: PersistParams) => {
    setBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch });
    } catch (err) {
      void reportError({ recovery: NOTHING_CHANGED, title: failureTitle, error: err, workspaceId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkflowRulesPanel
      workspaceId={workspaceId}
      runRows={
        <>
          <AutoLevelDefaultRow workspaceId={workspaceId} />
          <RunDefaultField workspaceId={workspaceId} />
        </>
      }
    >
      <Band inset="content" label="Agents" ariaLabel="Agents" headingLevel={2}>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="parallelAgents"
          help="Lets eligible agents split independent work and reconcile it in one output."
        >
          <Switch
            ariaLabel="Parallel agents"
            checked={parallelAgents}
            disabled={busy}
            onChange={(next) =>
              void persistOverrides({
                patch: { parallelAgents: next },
                failureTitle: "Couldn't save the parallel agents setting",
              })
            }
          />
        </WorkspaceFieldRow>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="verbosity"
          help="How much agents explain while they work."
        >
          <VerbositySelect
            value={verbosity}
            onChange={(v) =>
              void persistOverrides({
                patch: { defaultVerbosity: v },
                failureTitle: "Couldn't save the output verbosity",
              })
            }
            disabled={busy}
          />
        </WorkspaceFieldRow>
      </Band>
    </WorkflowRulesPanel>
  );
};

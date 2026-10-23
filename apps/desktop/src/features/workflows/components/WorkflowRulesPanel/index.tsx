import type { WorkflowRules, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useWorkflowRules } from '../../hooks/useWorkflowRules';
import { DefaultAsksSetting } from './DefaultAsksSetting';
import { DefaultAutoLimitSetting } from './DefaultAutoLimitSetting';
import { DefaultLimitSetting } from './DefaultLimitSetting';
import { DefaultModelsSetting } from './DefaultModelsSetting';
import { RulesGuidanceBand } from './RulesGuidanceBand';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkflowRulesPanel = ({ workspaceId }: Props) => {
  const { rules, patch } = useWorkflowRules({ workspaceId });
  const reportError = useAppStore((state) => state.reportError);
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const save = (next: Partial<WorkflowRules>) => {
    void patch(next).catch((error: unknown) => {
      void reportError({ title: "Couldn't save the workflow rules", error, workspaceId });
    });
  };
  return (
    <div data-testid="workflow-rules" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-title">Run defaults</h2>
        <p className="text-body text-muted-foreground">
          What a new run starts with. Each run keeps its own copy.
        </p>
      </div>
      <div
        role="group"
        aria-label="Run defaults"
        data-run-defaults=""
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        <DefaultAsksSetting autonomy={rules.autonomy} patch={patch} />
        <DefaultLimitSetting workspaceId={workspaceId} rules={rules} patch={patch} />
        <DefaultModelsSetting workspaceId={workspaceId} />
        <DefaultAutoLimitSetting workspaceId={workspaceId} workspaceName={workspaceName} />
      </div>
      <RulesGuidanceBand workspaceId={workspaceId} rules={rules} onChange={save} />
    </div>
  );
};

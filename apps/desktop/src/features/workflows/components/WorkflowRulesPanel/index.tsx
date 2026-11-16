import type { ReactNode } from 'react';
import type { WorkflowRules, WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useWorkflowRules } from '../../hooks/useWorkflowRules';
import { DefaultAsksSetting } from './DefaultAsksSetting';
import { DefaultLimitSetting } from './DefaultLimitSetting';
import { DefaultModelsSetting } from './DefaultModelsSetting';
import { RulesGuidanceBand } from './RulesGuidanceBand';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly runRows?: ReactNode;
  readonly children?: ReactNode;
};

export const WorkflowRulesPanel = ({ workspaceId, runRows, children }: Props) => {
  const { rules, patch } = useWorkflowRules({ workspaceId });
  const reportError = useAppStore((state) => state.reportError);
  const save = (next: Partial<WorkflowRules>) => {
    void patch(next).catch((error: unknown) => {
      void reportError({
        title: "Couldn't save the run defaults",
        error,
        workspaceId,
        recovery: NOTHING_CHANGED,
      });
    });
  };
  return (
    <div data-testid="workflow-rules" className="contents">
      <Band
        inset="content"
        label="New runs"
        ariaLabel="New runs"
        hint="Each run keeps its own copy."
        headingLevel={2}
      >
        <DefaultAsksSetting autonomy={rules.autonomy} patch={patch} />
        {runRows}
        <DefaultLimitSetting workspaceId={workspaceId} rules={rules} patch={patch} />
        <DefaultModelsSetting workspaceId={workspaceId} />
      </Band>
      {children}
      <RulesGuidanceBand workspaceId={workspaceId} rules={rules} onChange={save} />
    </div>
  );
};

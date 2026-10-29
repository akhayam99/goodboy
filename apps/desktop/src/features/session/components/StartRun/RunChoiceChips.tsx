import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { AutoLevelChip } from '../../../auto/level/AutoLevelChip';
import { agentKindPalette, visibleAgentKinds, type AgentKind } from '../../agent-kind';
import { runAsChoicesOf, runAsLabelOf } from '../../startRun/runAsOf';
import { RunAsChip } from './RunAsChip';
import { RunModelChip } from './RunModelChip';
import type { StartRunModel } from './useStartRun';

const ROLES = visibleAgentKinds()
  .filter((kind) => kind !== 'auto')
  .map((kind) => ({ kind, label: agentKindPalette({ kind }).label }));

type Props = {
  readonly run: StartRunModel;
  readonly workspaceId: WorkspaceId;
  readonly role: AgentKind | null;
};

export const RunChoiceChips = ({ run, workspaceId, role }: Props) => {
  const choices = useMemo(
    () => runAsChoicesOf({ presets: run.presets, roles: ROLES }),
    [run.presets],
  );
  const { model } = run;
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const isAutoLead = role === null && run.route.route.shape === 'lead' && run.route.role === null;
  return (
    <>
      {role === null ? (
        <RunAsChip
          label={runAsLabelOf({ runAs: run.runAs, choices })}
          choices={choices}
          isDisabled={run.isStarting}
          onChoose={({ runAs }) => run.setRunAs(runAs)}
        />
      ) : null}
      {role === null ? <RunModelChip model={model} isDisabled={run.isStarting} /> : null}
      {isAutoLead ? (
        <AutoLevelChip
          value={run.level}
          isPicked={run.isLevelPicked}
          workspaceName={workspaceName}
          isDisabled={run.isStarting}
          onPick={({ next }) => run.setLevel(next)}
        />
      ) : null}
    </>
  );
};

import { useMemo } from 'react';
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
  readonly role: AgentKind | null;
};

export const RunChoiceChips = ({ run, role }: Props) => {
  const choices = useMemo(
    () => runAsChoicesOf({ presets: run.presets, roles: ROLES }),
    [run.presets],
  );
  const { model } = run;
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
    </>
  );
};

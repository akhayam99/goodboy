import type { Session } from '@goodboy/types';
import type { PresetRunFocus } from '../../../../features/workflows/presetRunFocusOf';
import { useAttachedWorkflowRuns } from '../../../../features/workflows/useAttachedWorkflowRuns';
import { RunLevelBody } from './RunLevelBody';

type Props = {
  readonly session: Session;
  readonly focus: PresetRunFocus;
};

export const RunLevel = ({ session, focus }: Props) => {
  const attached =
    useAttachedWorkflowRuns({ session }).find(({ run }) => run.id === focus.runId) ?? null;
  if (attached === null) {
    return null;
  }
  return (
    <RunLevelBody
      session={session}
      run={attached.run}
      workflow={attached.workflow}
      selectedAgentId={focus.agentId}
    />
  );
};

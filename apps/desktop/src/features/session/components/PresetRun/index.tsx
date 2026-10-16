import { useEscapeLayer } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { RunWorkTime } from '../AgentTree/RunWorkTime';
import { leaveRunLevel } from '../../../workflows/leaveRunLevel';
import type { PresetRunFocus } from '../../../workflows/presetRunFocusOf';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { PresetRunBody } from './PresetRunBody';

type Props = {
  readonly session: Session;
  readonly focus: PresetRunFocus;
  readonly isActive: boolean;
};

export const PresetRunPage = ({ session, focus, isActive }: Props) => {
  const attached =
    useAttachedWorkflowRuns({ session }).find(({ run }) => run.id === focus.runId) ?? null;
  const agent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY).find(
        (candidate) => candidate.id === focus.agentId,
      ) ?? null,
  );
  useEscapeLayer(() => leaveRunLevel({ sessionId: session.id }), isActive && agent === null);
  if (attached === null) {
    return null;
  }
  return (
    <div data-preset-run={focus.runId} className="flex h-full min-h-0 min-w-0 flex-col">
      <RunWorkTime sessionId={session.id} workspaceId={session.workspaceId}>
        <PresetRunBody
          session={session}
          run={attached.run}
          workflow={attached.workflow}
          agent={agent}
          isActive={isActive}
        />
      </RunWorkTime>
    </div>
  );
};

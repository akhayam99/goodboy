import { PaneShell, useEscapeLayer, useSkeletonGate } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useIsSessionCollectionLoaded } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GoneObject } from '../../../../shared/components/GoneObject';
import { RunWorkTime } from '../AgentTree/RunWorkTime';
import { leaveRunLevel } from '../../../workflows/leaveRunLevel';
import type { PresetRunFocus } from '../../../workflows/presetRunFocusOf';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { PresetRunBody } from './PresetRunBody';
import { RunPageSkeleton } from './RunPageSkeleton';

type Props = {
  readonly session: Session;
  readonly focus: PresetRunFocus;
};

export const PresetRunPage = ({ session, focus }: Props) => {
  const attached =
    useAttachedWorkflowRuns({ session }).find(({ run }) => run.id === focus.runId) ?? null;
  const agent = useAppStore(
    (state) =>
      (state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY).find(
        (candidate) => candidate.id === focus.agentId,
      ) ?? null,
  );
  const isLoaded = useIsSessionCollectionLoaded({
    sessionId: session.id,
    collection: 'workflows',
  });
  const phase = useSkeletonGate({ gateKey: focus.runId, isLoaded });
  useEscapeLayer(() => leaveRunLevel({ sessionId: session.id }), agent === null);
  if (attached === null && (phase === 'skeleton' || phase === 'fading')) {
    return <RunPageSkeleton />;
  }
  if (attached === null) {
    return (
      <PaneShell page="run" title="Run">
        <GoneObject
          noun="run"
          icon={CONCEPT_ICONS.workflows}
          onBack={() => leaveRunLevel({ sessionId: session.id })}
        />
      </PaneShell>
    );
  }
  return (
    <div data-preset-run={focus.runId} className="flex h-full min-h-0 min-w-0 flex-col">
      <RunWorkTime sessionId={session.id} workspaceId={session.workspaceId}>
        <PresetRunBody
          session={session}
          run={attached.run}
          workflow={attached.workflow}
          agent={agent}
        />
      </RunWorkTime>
    </div>
  );
};

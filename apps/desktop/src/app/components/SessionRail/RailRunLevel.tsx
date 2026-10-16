import { ChevronLeft } from 'lucide-react';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import { leaveRunLevel } from '../../../features/workflows/leaveRunLevel';
import type { PresetRunFocus } from '../../../features/workflows/presetRunFocusOf';
import { runPlace } from '../../../features/workflows/runPlace';
import { useAttachedWorkflowRuns } from '../../../features/workflows/useAttachedWorkflowRuns';
import { RailButton } from '../SideColumn/RailButton';
import { RailRunSteps } from './RunLevel/RailRunSteps';

type Props = {
  readonly session: Session;
  readonly focus: PresetRunFocus;
};

export const RailRunLevel = ({ session, focus }: Props) => {
  const sessionId = session.id;
  const navigate = useAppStore((state) => state.navigate);
  const attached =
    useAttachedWorkflowRuns({ session }).find(({ run }) => run.id === focus.runId) ?? null;
  const open = (agentId: Agent['id'] | null) =>
    navigate({ to: runPlace({ sessionId, runId: focus.runId, agentId }) });

  return (
    <div data-rail-level="run" className="flex flex-col items-center gap-1 px-2">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        iconSize={ICON_SIZE.row}
        label={`Back to ${NAMES.runs}`}
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={() => leaveRunLevel({ sessionId })}
      />
      <RailButton
        id="run-overview"
        icon={CONCEPT_ICONS.timeline}
        iconSize={ICON_SIZE.row}
        label={NAMES.overview}
        isCurrent={focus.agentId === null}
        isPage
        onSelect={() => open(null)}
      />
      {attached === null ? null : (
        <RailRunSteps
          session={session}
          run={attached.run}
          workflow={attached.workflow}
          focus={focus}
          onOpen={(agentId) => open(agentId)}
        />
      )}
    </div>
  );
};

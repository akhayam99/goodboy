import { EmptyLine, ScrollFade } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { AutoWorkRail } from '../../../features/auto/chat/AutoWorkRail';
import { useAutoTreeActions } from '../../../features/auto/chat/useAutoTreeActions';
import { AutoLimitFoot } from '../../../features/auto/level/AutoLimitFoot';
import { useAutoLevel } from '../../../features/auto/level/useAutoLevel';
import { LevelBackRow } from './LevelBackRow';

type Props = {
  readonly session: Session;
};

export const AutoLevel = ({ session }: Props) => {
  const level = useAutoLevel({ session });
  const pickSidebarLevel = useAppStore((state) => state.pickSidebarLevel);
  const actions = useAutoTreeActions({ sessionId: session.id });
  const view = level.tree?.view ?? null;
  const hasChildren = level.rows.length > 1;

  return (
    <div data-auto-level="" className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="shrink-0 px-2">
        <LevelBackRow
          label={sessionTitle({ session })}
          onBack={() => pickSidebarLevel({ level: 'session' })}
        />
      </div>
      <ScrollFade className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-2 pb-2">
          <AutoWorkRail
            rows={level.rows}
            selectedAgentId={level.shownAgentId}
            onOpen={actions.openRow}
          />
          {hasChildren ? null : <EmptyLine className="px-2">No agents started yet</EmptyLine>}
        </div>
      </ScrollFade>
      {view === null || view.budget === null ? null : (
        <AutoLimitFoot sessionId={session.id} treeId={view.tree.id} facts={view.budget} />
      )}
    </div>
  );
};

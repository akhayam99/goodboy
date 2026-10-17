import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { usePresetRunFocus } from '../../../features/session/hooks/usePresetRunFocus';
import { openLens } from '../../../features/session/openLens';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { AutoLevel } from './AutoLevel';
import { LevelBackRow } from './LevelBackRow';
import { LevelStack } from './LevelStack';
import { RunLevel } from './RunLevel';
import { SessionLevel } from './SessionLevel';
import { WorktreeLevel } from './WorktreeLevel';
import { useIsOnAutoAgent } from './useIsOnAutoAgent';

type Props = {
  readonly session: Session;
  readonly level: RailLevel;
  readonly isStudioOver: boolean;
};

export const SessionRailLevels = ({ session, level, isStudioOver }: Props) => {
  const sessionId = session.id;
  const runFocus = usePresetRunFocus({ sessionId });
  const isOnAutoAgent = useIsOnAutoAgent({ currentSessionId: sessionId });
  const isBranchless = useAppStore((state) =>
    isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const title = sessionTitle({ session });
  return (
    <LevelStack
      level={level}
      layers={[
        {
          level: 'session',
          node: <SessionLevel session={session} isActive={level === 'session' && !isStudioOver} />,
        },
        {
          level: 'worktree',
          node: isBranchless ? null : (
            <>
              <div className="shrink-0 px-2">
                <LevelBackRow
                  label={title}
                  spokenLabel={`session ${title}`}
                  onBack={() => openLens({ sessionId, lens: null })}
                />
              </div>
              {level === 'worktree' ? <WorktreeLevel session={session} /> : null}
            </>
          ),
        },
        {
          level: 'run',
          node: runFocus === null ? null : <RunLevel session={session} focus={runFocus} />,
        },
        {
          level: 'auto',
          node: isOnAutoAgent ? <AutoLevel session={session} /> : null,
        },
      ]}
    />
  );
};

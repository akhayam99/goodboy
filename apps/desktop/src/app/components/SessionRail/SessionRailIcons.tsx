import type { Session } from '@goodboy/types';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { usePresetRunFocus } from '../../../features/session/hooks/usePresetRunFocus';
import { LevelStack } from './LevelStack';
import { RailAutoLevel } from './RailAutoLevel';
import { RailRunLevel } from './RailRunLevel';
import { RailSessionLevel } from './RailSessionLevel';
import { RailWorktreeLevel } from './RailWorktreeLevel';

type Props = {
  readonly session: Session;
  readonly level: RailLevel;
};

export const SessionRailIcons = ({ session, level }: Props) => {
  const runFocus = usePresetRunFocus({ sessionId: session.id });
  return (
    <LevelStack
      level={level}
      layers={[
        { level: 'session', node: <RailSessionLevel session={session} /> },
        {
          level: 'worktree',
          node: level === 'worktree' ? <RailWorktreeLevel session={session} /> : null,
        },
        {
          level: 'run',
          node:
            level === 'run' && runFocus !== null ? (
              <RailRunLevel session={session} focus={runFocus} />
            ) : null,
        },
        { level: 'auto', node: level === 'auto' ? <RailAutoLevel session={session} /> : null },
      ]}
    />
  );
};

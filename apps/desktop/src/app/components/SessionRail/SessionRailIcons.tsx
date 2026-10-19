import type { Session } from '@goodboy/types';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { LevelStack } from './LevelStack';
import { RailSessionLevel } from './RailSessionLevel';
import { RailWorktreeLevel } from './RailWorktreeLevel';

type Props = {
  readonly session: Session;
  readonly level: RailLevel;
};

export const SessionRailIcons = ({ session, level }: Props) => (
  <LevelStack
    level={level}
    layers={[
      { level: 'session', node: <RailSessionLevel session={session} /> },
      {
        level: 'worktree',
        node: level === 'worktree' ? <RailWorktreeLevel session={session} /> : null,
      },
    ]}
  />
);

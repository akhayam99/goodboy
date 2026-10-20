import type { Session } from '@goodboy/types';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { LevelStack } from './LevelStack';
import { SessionLevel } from './SessionLevel';

type Props = {
  readonly session: Session;
  readonly level: RailLevel;
  readonly isStudioOver: boolean;
};

export const SessionRailLevels = ({ session, level, isStudioOver }: Props) => (
  <LevelStack
    level={level}
    layers={[
      {
        level: 'session',
        node: <SessionLevel session={session} isActive={level === 'session' && !isStudioOver} />,
      },
    ]}
  />
);

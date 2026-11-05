import type { Session } from '@goodboy/types';
import { LEVEL_LAYER } from './levelLayerClass';
import { SessionLevel } from './SessionLevel';

type Props = {
  readonly session: Session;
  readonly isStudioOver: boolean;
};

export const SessionRailLevels = ({ session, isStudioOver }: Props) => (
  <div data-level-stack="session" className="relative min-h-0 flex-1 overflow-clip">
    <div data-level-layer="session" className={LEVEL_LAYER}>
      <SessionLevel session={session} isActive={!isStudioOver} />
    </div>
  </div>
);

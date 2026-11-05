import type { Session } from '@goodboy/types';
import { LEVEL_LAYER } from './levelLayerClass';
import { RailSessionLevel } from './RailSessionLevel';

type Props = {
  readonly session: Session;
};

export const SessionRailIcons = ({ session }: Props) => (
  <div data-level-stack="session" className="relative min-h-0 flex-1 overflow-clip">
    <div data-level-layer="session" className={LEVEL_LAYER}>
      <RailSessionLevel session={session} />
    </div>
  </div>
);

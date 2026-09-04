import type { SessionStage } from '@goodboy/types';
import { SESSION_STAGE_ICON } from '../../../../session/session-stage';

type Props = {
  readonly stage: SessionStage;
};

export const StageGlyph = ({ stage }: Props) => {
  const Icon = SESSION_STAGE_ICON[stage];
  return <Icon size={11} aria-hidden />;
};

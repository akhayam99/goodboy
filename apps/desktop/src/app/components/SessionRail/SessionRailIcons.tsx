import type { Session } from '@goodboy/types';
import type { RailLevel } from '../../../store/slices/navigation/railLevel';
import { usePresetRunFocus } from '../../../features/session/hooks/usePresetRunFocus';
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
  if (level === 'worktree') {
    return <RailWorktreeLevel session={session} />;
  }
  if (level === 'run' && runFocus !== null) {
    return <RailRunLevel session={session} focus={runFocus} />;
  }
  if (level === 'auto') {
    return <RailAutoLevel session={session} />;
  }
  return <RailSessionLevel session={session} />;
};

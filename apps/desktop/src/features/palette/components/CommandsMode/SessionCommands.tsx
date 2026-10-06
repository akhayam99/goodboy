import type { Session } from '@goodboy/types';
import { useSessionPalette } from '../../hooks/useSessionPalette';
import type { PaletteModeProps } from '../../paletteModeTypes';
import { CommandsBody } from './CommandsBody';

type Props = PaletteModeProps & {
  readonly session: Session;
};

export const SessionCommands = ({ session, ...props }: Props) => {
  const palette = useSessionPalette({ session });
  return <CommandsBody {...props} palette={palette} />;
};

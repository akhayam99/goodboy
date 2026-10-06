import { useCurrentSession } from '../../../../store';
import type { PaletteModeProps } from '../../paletteModeTypes';
import { CommandsBody } from './CommandsBody';
import { SessionCommands } from './SessionCommands';

export const CommandsMode = (props: PaletteModeProps) => {
  const session = useCurrentSession();
  return session === null ? (
    <CommandsBody {...props} palette={null} />
  ) : (
    <SessionCommands {...props} session={session} />
  );
};

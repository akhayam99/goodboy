import type { MoveCommand } from '../types';
import { isDestructiveScript } from './isDestructiveScript';

type Params = {
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
};

export const scriptCommandOf = ({ scriptId, name, command, cwd }: Params): MoveCommand => {
  const isDestructive = isDestructiveScript({ name });
  return {
    text: command,
    cwd,
    mode: isDestructive ? 'type' : 'run',
    scriptId,
  };
};

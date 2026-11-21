import type { MoveCommand } from '../types';
import { shellQuote } from './shellQuote';

type Params = {
  readonly base: string;
  readonly manager: string;
  readonly target: string;
  readonly cwd: string;
};

export const testCommandOf = ({ base, manager, target, cwd }: Params): MoveCommand => ({
  text: `${base}${manager === 'npm' ? ' --' : ''} ${shellQuote({ text: target })}`,
  cwd,
  mode: 'type',
  scriptId: null,
});

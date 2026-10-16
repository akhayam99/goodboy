import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

type Params = Pick<SliceDeps, 'set'>;

type ScopeParams = {
  readonly sessionId: SessionId;
  readonly cwd: string;
};

export const rememberTerminalScope = ({ set }: Params) => {
  return ({ sessionId, cwd }: ScopeParams): void => {
    set((s) =>
      s.terminalScopes[sessionId] === cwd
        ? s
        : { terminalScopes: { ...s.terminalScopes, [sessionId]: cwd } },
    );
  };
};

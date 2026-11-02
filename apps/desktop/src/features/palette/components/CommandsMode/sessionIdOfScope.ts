import type { SessionId } from '@goodboy/types';
import type { PaletteScope } from '../../types';

type Params = {
  readonly scope: PaletteScope | null;
};

export const sessionIdOfScope = ({ scope }: Params): SessionId | null =>
  scope !== null &&
  (scope.kind === 'session' ||
    scope.kind === 'agent' ||
    scope.kind === 'workflowRun' ||
    scope.kind === 'pullRequest')
    ? scope.sessionId
    : null;

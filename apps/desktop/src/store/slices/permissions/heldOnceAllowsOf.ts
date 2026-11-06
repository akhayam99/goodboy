import { oncePatternText } from '@goodboy/core/permissions';
import type { AnsweredAsk } from '../../../features/permissions/askBatchOf';

type Params = {
  readonly held: ReadonlyArray<AnsweredAsk>;
};

export const heldOnceAllowsOf = ({ held }: Params): ReadonlyArray<string> =>
  held
    .filter((ask) => ask.decision === 'allow' && ask.scope === 'once')
    .map((ask) => oncePatternText({ toolName: ask.toolName, input: ask.input }));

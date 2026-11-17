import type { LeadLockedRow } from '@goodboy/core/auto';
import { NAMES } from '../../../shared/utils/names';

const LOCKED_WORDS: Readonly<Record<LeadLockedRow, string>> = {
  forcePushAsks: 'force push asks',
  mergeIsYou: 'you merge',
  agentsNeverPush: 'agents never push',
  leadNeverWrites: `the ${NAMES.lead} never writes code`,
};

type Props = {
  readonly rows: ReadonlyArray<LeadLockedRow>;
};

export const LockedRows = ({ rows }: Props) => (
  <p data-locked-rows="" className="text-meta text-faint-foreground">
    Always: {rows.map((row) => LOCKED_WORDS[row]).join(', ')}.
  </p>
);

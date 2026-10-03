import { PROVIDER_LABEL } from '../../providerLabel';
import { moveRow, type PolicyRow } from '../../policy/policyRows';

const ORDINALS: ReadonlyArray<string> = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

type OrdinalParams = {
  readonly position: number;
};

const ordinalOf = ({ position }: OrdinalParams): string =>
  ORDINALS[position - 1] ?? `number ${position}`;

type NoteParams = {
  readonly rows: ReadonlyArray<PolicyRow>;
  readonly from: number;
  readonly to: number;
  readonly isDone: boolean;
};

export const reorderNote = ({ rows, from, to, isDone }: NoteParams): string => {
  const moved = rows[from];
  if (moved === undefined) {
    return '';
  }
  const name = PROVIDER_LABEL[moved.id];
  const next = moveRow({ rows, from, to });
  const firstOn = next.find((row) => row.state === 'on' && !row.isNew)?.id ?? null;
  const becomesDefault = to === 0 && firstOn === moved.id;
  if (isDone) {
    return becomesDefault
      ? `${name} is now the default for new work`
      : `${name} is now ${ordinalOf({ position: to + 1 })}`;
  }
  if (becomesDefault) {
    return `Release to put ${name} first. It becomes the default for new work.`;
  }
  if (to === 0) {
    const stays = firstOn === null ? 'unset' : PROVIDER_LABEL[firstOn];
    return `Release to put ${name} first. The default stays ${stays}.`;
  }
  return `Release to put ${name} ${ordinalOf({ position: to + 1 })}.`;
};

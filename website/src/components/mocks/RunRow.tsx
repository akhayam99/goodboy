import { HARBORLINE, type ChipKind, type RunRowData } from '../../data/harborline';
import { formatCents } from './formatCents';
import { ProviderIcon } from './ProviderIcon';
import { StateChip } from './StateChip';

const { PROVIDER_NAME } = HARBORLINE;

type Props = {
  readonly row: RunRowData;
  readonly state: ChipKind;
};

export const RunRow = ({ row, state }: Props) => (
  <div className={state === 'queued' ? 'mk-row is-queued' : 'mk-row'}>
    <span className="mk-role mk-ell">{row.role}</span>
    <span className="mk-step mk-ell">{row.step}</span>
    <span className="mk-model">
      <ProviderIcon provider={row.provider} />
      <span className="mk-ell">
        <span className="mk-prov">{PROVIDER_NAME[row.provider]} </span>
        {row.model}
      </span>
    </span>
    <span className="mk-state">
      <StateChip kind={state} />
    </span>
    <span
      className={state === 'done' ? 'mk-cost mk-num' : 'mk-cost mk-num is-empty'}
      aria-hidden={state === 'done' ? undefined : true}
    >
      {formatCents({ cents: row.cents })}
    </span>
  </div>
);

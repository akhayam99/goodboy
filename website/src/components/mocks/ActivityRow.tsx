import type { ActivityRowData, ChipKind } from '../../data/harborline';
import { ProviderIcon } from './ProviderIcon';
import { StateChip } from './StateChip';

type Props = {
  readonly row: ActivityRowData;
  readonly state: ChipKind;
  readonly isAsking?: boolean;
};

export const ActivityRow = ({ row, state, isAsking = false }: Props) => (
  <div className={isAsking ? 'mk-arow is-asking' : 'mk-arow'}>
    <ProviderIcon provider={row.provider} />
    <span className="mk-role mk-ell">{row.role}</span>
    <span className="mk-what mk-ell">{row.what}</span>
    <span className="mk-model mk-ell">{row.model}</span>
    <span className="mk-state">
      <StateChip kind={state} />
    </span>
  </div>
);

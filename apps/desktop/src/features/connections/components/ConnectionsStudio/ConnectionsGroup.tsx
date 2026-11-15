import { SectionHeader } from '@goodboy/ui';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import { openSettings } from '../../../settings/openSettings';
import type { ConnectionRow } from '../../connectionRow';
import { openConnection } from '../../openConnection';

type OpenParams = {
  readonly row: ConnectionRow;
};

const openRow = ({ row }: OpenParams): void => {
  const { provider } = row.target;
  if (provider !== undefined) {
    openConnection({ focus: { provider } });
    return;
  }
  openSettings(row.target);
};

type Props = {
  readonly id: 'providers' | 'tools';
  readonly label: string;
  readonly place: string;
  readonly rows: ReadonlyArray<ConnectionRow>;
};

export const ConnectionsGroup = ({ id, label, place, rows }: Props) => (
  <section aria-label={label} data-connections-group={id} className="flex flex-col gap-2">
    <SectionHeader
      label={label}
      headingLevel={2}
      meta={<span className="text-meta text-faint-foreground">{place}</span>}
    />
    <ul className="flex flex-col gap-0.5">
      {rows.map((row) => (
        <li key={row.key} data-connections-row={row.key}>
          <SettingsNavRow label={row.label} status={row.status} onClick={() => openRow({ row })} />
        </li>
      ))}
    </ul>
  </section>
);

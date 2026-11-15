import { SectionHeader } from '@goodboy/ui';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import { openSettings } from '../../../settings/openSettings';
import type { ConnectionRow, ConnectionTarget } from '../../connectionRow';
import { openToolPage } from '../../openToolPage';

type Props = {
  readonly id: 'providers' | 'tools';
  readonly label: string;
  readonly place: string;
  readonly rows: ReadonlyArray<ConnectionRow>;
};

type OpenParams = {
  readonly target: ConnectionTarget;
};

const openTarget = ({ target }: OpenParams): void => {
  if (target.kind === 'tool') {
    openToolPage({ tool: target.tool });
    return;
  }
  openSettings(target.change);
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
          <SettingsNavRow
            label={row.label}
            status={row.status}
            onClick={() => openTarget({ target: row.target })}
          />
        </li>
      ))}
    </ul>
  </section>
);

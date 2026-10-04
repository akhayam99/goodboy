import { STRIPED_ROW, STRIPED_TABLE, cn } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { MODE_COPY, PICKER_MODES } from '../../modeCopy';
import {
  ROLE_LIMIT_CELL,
  SUPPORT_COLUMNS,
  modeCell,
  ruleCell,
  type SupportCell,
} from '../../utils/providerSupport';
import { SupportCellView } from './SupportCellView';

type Row = {
  readonly key: string;
  readonly label: string;
  readonly cellFor: (provider: (typeof SUPPORT_COLUMNS)[number]) => SupportCell;
};

const ROWS: ReadonlyArray<Row> = [
  ...PICKER_MODES.map((mode) => ({
    key: mode,
    label: MODE_COPY[mode].label,
    cellFor: (provider: (typeof SUPPORT_COLUMNS)[number]) => modeCell({ provider, mode }),
  })),
  { key: 'rules', label: 'Rules', cellFor: (provider) => ruleCell({ provider }) },
  { key: 'roles', label: 'Role limits', cellFor: () => ROLE_LIMIT_CELL },
];

const COLUMN_LABEL = {
  anthropic: PROVIDER_LABEL.anthropic,
  codex: PROVIDER_LABEL.codex,
  cursor: PROVIDER_LABEL.cursor,
  gemini: PROVIDER_LABEL.gemini,
  opencode: 'OpenCode family',
} satisfies Record<(typeof SUPPORT_COLUMNS)[number], string>;

export const ProviderSupportTable = () => (
  <div className="flex flex-col gap-2">
    <div className="rounded-lg bg-subtle p-1">
      <table className={cn('w-full table-fixed', STRIPED_TABLE)}>
        <caption className="sr-only">What each provider does with these settings</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-2">
              <span className="sr-only">Setting</span>
            </th>
            {SUPPORT_COLUMNS.map((provider) => (
              <th
                key={provider}
                scope="col"
                className="px-2 py-2 text-left text-label font-normal text-muted-foreground"
              >
                {COLUMN_LABEL[provider]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.key} className={cn('align-top', STRIPED_ROW)}>
              <th
                scope="row"
                className="px-2 py-2 text-left text-label font-normal text-foreground"
              >
                {row.label}
              </th>
              {SUPPORT_COLUMNS.map((provider) => (
                <td key={provider} className="px-2 py-2">
                  <SupportCellView cell={row.cellFor(provider)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="text-meta text-muted-foreground">
      A mode a provider can&apos;t honor is never made looser: the agent runs in the next stricter
      mode that provider has. Role limits are instructions to the agent, checked after each turn, on
      every provider.
    </p>
  </div>
);

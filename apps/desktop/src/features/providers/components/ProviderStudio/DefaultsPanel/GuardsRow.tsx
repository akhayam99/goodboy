import { AUTO_WRITER_CHILD_PROVIDERS, isAutoOwnProvider } from '@goodboy/core/auto';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { SettingRow } from '../../../../settings/settingRow';

type Props = {
  readonly providers: ReadonlyArray<ProviderId>;
};

const LIST_FORMAT = new Intl.ListFormat('en', { type: 'disjunction' });

type GuardsParams = {
  readonly providers: ReadonlyArray<ProviderId>;
};

const guardsOf = ({ providers }: GuardsParams): ReadonlyArray<string> => {
  const noWriters = providers.filter(
    (id) =>
      isAutoOwnProvider({ provider: id }) &&
      !AUTO_WRITER_CHILD_PROVIDERS.some((writer) => writer === id),
  );
  return [
    'A provider that is Off, not connected or cooling down',
    'A provider at its limit, unless it keeps going after the limit',
    'A provider past its budget',
    ...(noWriters.length === 0
      ? []
      : [
          `An agent that writes code on ${LIST_FORMAT.format(noWriters.map((id) => PROVIDER_LABEL[id]))}`,
        ]),
    "A model outside a role's pinned models, while one of them can run",
  ];
};

export const GuardsRow = ({ providers }: Props) => (
  <SettingRow
    label="Never picked"
    help="A pick that breaks one starts on the next candidate instead."
  >
    <ul aria-label="Never picked" className="flex w-80 min-w-0 flex-col gap-1 text-meta">
      {guardsOf({ providers }).map((guard) => (
        <li key={guard} className="text-muted-foreground">
          {guard}
        </li>
      ))}
    </ul>
  </SettingRow>
);

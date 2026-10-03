import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../providerLabel';
import type { PolicyRow } from './policyRows';

export type PolicySummary = Readonly<{
  text: string;
  on: ReadonlyArray<ProviderId>;
  backup: ReadonlyArray<ProviderId>;
}>;

type Params = {
  readonly rows: ReadonlyArray<PolicyRow>;
};

type NamesParams = {
  readonly ids: ReadonlyArray<ProviderId>;
};

const namesOf = ({ ids }: NamesParams): string => ids.map((id) => PROVIDER_LABEL[id]).join(', ');

const summaryText = ({ on, backup }: Pick<PolicySummary, 'on' | 'backup'>): string => {
  if (on.length > 0 && backup.length > 0) {
    return `${namesOf({ ids: on })} · ${namesOf({ ids: backup })} as backup`;
  }
  if (on.length > 0) {
    return namesOf({ ids: on });
  }
  if (backup.length > 0) {
    return `Backup only · ${namesOf({ ids: backup })}`;
  }
  return 'No provider is on';
};

export const policySummary = ({ rows }: Params): PolicySummary => {
  const on = rows.filter((row) => row.state === 'on' && !row.isNew).map((row) => row.id);
  const backup = rows.filter((row) => row.state === 'backup' && !row.isNew).map((row) => row.id);
  return { text: summaryText({ on, backup }), on, backup };
};

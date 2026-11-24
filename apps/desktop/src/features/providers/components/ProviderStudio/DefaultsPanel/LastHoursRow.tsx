import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { SettingRow } from '../../../../settings/settingRow';

type Props = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly lastHours: Readonly<Partial<Record<ProviderId, number>>>;
};

export const LastHoursRow = ({ providers, lastHours }: Props) => {
  const counts = providers.map((id) => `${PROVIDER_LABEL[id]} ${lastHours[id] ?? 0}`);
  return (
    <SettingRow label="Last 5 hours" help="Agents per provider, the ones running now included.">
      <span data-testid="last-hours" className="text-meta text-foreground">
        {counts.join(' · ')}
      </span>
    </SettingRow>
  );
};

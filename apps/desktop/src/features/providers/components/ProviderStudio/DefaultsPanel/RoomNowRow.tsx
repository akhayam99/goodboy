import type { CandidateInputs } from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { ICON_SIZE, Meter, type Tone } from '@goodboy/ui';
import { ProviderGlyph } from '../../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../providerLabel';
import { SettingRow } from '../../../../settings/settingRow';
import { roomTextOf } from './roomTextOf';

type Props = {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly inputs: CandidateInputs;
};

const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

const FULL_PERCENT = 100;

const NEAR_PERCENT = 80;

type ToneParams = {
  readonly usedPercent: number;
};

const roomToneOf = ({ usedPercent }: ToneParams): Tone => {
  if (usedPercent >= FULL_PERCENT) {
    return 'danger';
  }
  return usedPercent >= NEAR_PERCENT ? 'warning' : 'neutral';
};

type HelpParams = {
  readonly estimated: ReadonlyArray<ProviderId>;
};

const helpOf = ({ estimated }: HelpParams): string => {
  const lead = 'The Lead sees these numbers when it picks a provider.';
  if (estimated.length === 0) {
    return lead;
  }
  const names = LIST_FORMAT.format(estimated.map((id) => PROVIDER_LABEL[id]));
  const verb = estimated.length === 1 ? 'has' : 'have';
  return `${lead} ${names} ${verb} no usage reading, so Goodboy estimates it from recent turns and rate limits.`;
};

export const RoomNowRow = ({ providers, inputs }: Props) => {
  const shown = providers.filter((id) => inputs.room?.[id] !== undefined);
  const estimated = shown.filter((id) => inputs.room?.[id]?.isEstimated === true);
  if (shown.length === 0) {
    return null;
  }
  return (
    <SettingRow label="Room right now" help={helpOf({ estimated })}>
      <ul aria-label="Room right now" className="flex w-80 min-w-0 flex-col gap-1">
        {shown.map((id, index) => {
          const usedPercent = inputs.room?.[id]?.usedPercent ?? 0;
          return (
            <li key={id} className="flex min-w-0 items-center gap-2 text-meta">
              <span className="w-4 shrink-0 text-faint-foreground">{index + 1}</span>
              <ProviderGlyph id={id} size={ICON_SIZE.control} />
              <span className="w-16 shrink-0 truncate text-foreground">{PROVIDER_LABEL[id]}</span>
              <Meter
                label={`${PROVIDER_LABEL[id]} used`}
                value={usedPercent}
                tone={roomToneOf({ usedPercent })}
                size="xs"
                className="w-24 shrink-0"
              />
              <span className="min-w-0 truncate text-muted-foreground">
                {roomTextOf({ provider: id, inputs })}
              </span>
            </li>
          );
        })}
      </ul>
    </SettingRow>
  );
};

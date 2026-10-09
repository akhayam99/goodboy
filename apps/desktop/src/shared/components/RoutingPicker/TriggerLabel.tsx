import { Fragment } from 'react';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND } from '../../../features/providers/components/provider-brand';
import { TriggerSeparator } from './TriggerSeparator';
import { routingNameText, type RoutingTriggerLabel } from './routingSummary';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly provider: ProviderId;
  readonly label: RoutingTriggerLabel;
};

export const TriggerLabel = ({ provider, label }: Props) => {
  const ProviderGlyph = PROVIDER_BRAND[provider].icon;
  return (
    <>
      <ProviderGlyph size={ICON_SIZE.row} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate font-sans font-medium text-foreground">
        {routingNameText(label)}
      </span>
      {label.detail.map((segment) => (
        <Fragment key={segment}>
          <TriggerSeparator />
          <span className="shrink-0 text-muted-foreground">{segment}</span>
        </Fragment>
      ))}
    </>
  );
};

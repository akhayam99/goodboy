import type { ProviderId } from '@goodboy/types';
import { ProviderGlyph } from './ProviderGlyph';
import { TriggerSeparator } from './TriggerSeparator';
import { routingNameText, type RoutingTriggerLabel } from './routingSummary';
import { ICON_SIZE } from '@goodboy/ui';

type Props = {
  readonly provider: ProviderId;
  readonly label: RoutingTriggerLabel;
  readonly prefix?: string;
};

export const TriggerLabel = ({ provider, label, prefix }: Props) => {
  return (
    <>
      <ProviderGlyph id={provider} size={ICON_SIZE.row} />
      {prefix === undefined ? null : (
        <span className="flex shrink-0 items-center gap-2 @max-md:hidden">
          <span data-routing-prefix="" className="text-foreground">
            {prefix}
          </span>
          <TriggerSeparator />
        </span>
      )}
      <span className="min-w-0 truncate font-sans font-medium text-foreground @max-sm:hidden">
        {routingNameText(label)}
      </span>
      {label.detail.map((segment) => (
        <span key={segment} className="flex shrink-0 items-center gap-2 @max-md:hidden">
          <TriggerSeparator />
          <span className="text-muted-foreground">{segment}</span>
        </span>
      ))}
    </>
  );
};

import { PROVIDER_CONNECT_CAPABILITIES, isApiProvider } from '@goodboy/core';
import { Button } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { type ProviderDisplayInfo } from '../../../providers/providers';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { StatusPill } from '../../../providers/components/ProviderConnect/StatusPill';
import { ProviderInlineConnect } from '../../../providers/components/ProviderInlineConnect';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly isExpanded: boolean;
  readonly onExpandedChange: (params: { readonly providerId: ProviderId | null }) => void;
};

export const providerRowAction = ({
  info,
}: {
  readonly info: ProviderDisplayInfo;
}): string | null => {
  if (info.connection === 'connected') {
    return null;
  }
  if (isApiProvider({ id: info.id })) {
    return 'Add key';
  }
  if (PROVIDER_CONNECT_CAPABILITIES[info.id].tier === 'manual') {
    return 'Set up manually';
  }
  if (info.connection === 'missing') {
    return 'Install';
  }
  return 'Connect';
};

export const ProviderRow = ({ info, isExpanded, onExpandedChange }: Props) => {
  const Icon = PROVIDER_BRAND[info.id].icon;
  const label = PROVIDER_LABEL[info.id];
  const action = providerRowAction({ info });
  const isApi = isApiProvider({ id: info.id });
  const collapse = () => onExpandedChange({ providerId: null });

  return (
    <li className="flex flex-col rounded-lg border border-border-soft bg-subtle">
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-subtle"
          style={{ color: brandColor(info.id) }}
        >
          <Icon size={ICON_SIZE.hero} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-row capitalize text-foreground">{label}</span>
          <StatusPill connection={info.connection} />
        </div>
        {isExpanded && !isApi && (
          <Button size="sm" variant="ghost" onClick={collapse}>
            Close
          </Button>
        )}
        {!isExpanded && action !== null && (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${action} ${label}`}
            onClick={() => onExpandedChange({ providerId: info.id })}
          >
            {action}
          </Button>
        )}
      </div>
      {isExpanded && (
        <div className="border-t border-border-soft">
          <ProviderInlineConnect providerId={info.id} autoStart onDone={collapse} />
        </div>
      )}
    </li>
  );
};

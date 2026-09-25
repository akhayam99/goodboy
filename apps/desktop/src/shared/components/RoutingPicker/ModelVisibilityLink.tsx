import { Settings2 } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { Tooltip } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { MODELS_SECTION } from '../../../features/providers/components/ProviderStudio/ModelVisibilitySection/constants';

type Props = {
  readonly provider: ProviderId;
  readonly onNavigate: () => void;
};

export const ModelVisibilityLink = ({ provider, onNavigate }: Props) => {
  const label = `Choose which ${PROVIDER_LABEL[provider]} models show here`;
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          onNavigate();
          window.dispatchEvent(
            new CustomEvent('goodboy:open-settings', {
              detail: { scope: 'providers', provider, section: MODELS_SECTION },
            }),
          );
        }}
        className="inline-flex size-5 items-center justify-center rounded-sm text-faint-foreground transition-colors hover:bg-hover hover:text-foreground"
      >
        <Settings2 size={14} aria-hidden />
      </button>
    </Tooltip>
  );
};

import { Settings2 } from 'lucide-react';
import type { ProviderId } from '@goodboy/types';
import { ICON_SIZE, IconButton } from '@goodboy/ui';
import { PROVIDER_LABEL } from '../../../features/providers/providerLabel';
import { MODELS_SECTION } from '../../../features/providers/components/ProviderStudio/ProviderPage/ModelsGroup/constants';
import { openSettings } from '../../../features/settings/openSettings';

type Props = {
  readonly provider: ProviderId;
  readonly onNavigate: () => void;
};

export const ModelVisibilityLink = ({ provider, onNavigate }: Props) => {
  const label = `Choose which ${PROVIDER_LABEL[provider]} models show here`;
  return (
    <IconButton
      icon={Settings2}
      label={label}
      size="xs"
      iconSize={ICON_SIZE.control}
      onClick={() => {
        onNavigate();
        openSettings({ scope: 'providers', provider, section: MODELS_SECTION });
      }}
      className="size-5"
    />
  );
};

import { Button, ScrollFade } from '@goodboy/ui';
import { isApiProvider, type ProviderId, type ProviderLifecycleAction } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PROVIDER_LABEL } from '../../../chat/utils/chat-constants';
import { ProviderConnectPane } from '../ProviderStudio/ProviderConnectPane';
import { ProviderCredentialsSection } from '../ProviderStudio/ProviderCredentialsSection';

type Props = {
  readonly providerId: ProviderId;
  readonly action?: ProviderLifecycleAction;
  readonly onDone: () => void;
};

export const ProviderInlineConnect = ({ providerId, action, onDone }: Props) => {
  const provider = useAppStore((state) =>
    state.providers.find((candidate) => candidate.id === providerId),
  );
  const resolvedAction = action ?? (provider?.connection === 'missing' ? 'install' : 'login');

  if (isApiProvider({ id: providerId })) {
    return (
      <ScrollFade className="max-h-96" fadeFrom="subtle">
        <section
          aria-label={`Connect ${PROVIDER_LABEL[providerId]}`}
          className="flex flex-col gap-3 p-3"
        >
          <ProviderCredentialsSection providerId={providerId} />
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={onDone}>
              Back
            </Button>
          </div>
        </section>
      </ScrollFade>
    );
  }

  return (
    <ScrollFade className="max-h-96" fadeFrom="subtle">
      <ProviderConnectPane
        providerId={providerId}
        action={resolvedAction}
        autoStart={false}
        chrome="inline"
        onBack={onDone}
      />
    </ScrollFade>
  );
};

import { useState } from 'react';
import { PROVIDER_API_KEY_ENV, isApiProvider } from '@goodboy/core';
import { BAND_ROW_CLASS, Band, cn } from '@goodboy/ui';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../../../../store';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ProviderCredentialsSection } from '../../ProviderCredentialsSection';
import { ProviderBindingsSection } from '../../ProviderBindingsSection';
import { CliRow } from './CliRow';
import { RuntimeRow } from './RuntimeRow';
import { SignedInRow } from './SignedInRow';
import type { AccountGroupProps } from './types';

export type { AccountConfirm } from './types';

export const AccountGroup = (props: AccountGroupProps) => {
  const { info } = props;
  const isApi = isApiProvider({ id: info.id });
  const hasKeyOption = PROVIDER_API_KEY_ENV[info.id] !== undefined;
  const hasKeys = useAppStore((state) =>
    state.providerCredentials.some((credential) => credential.providerId === info.id),
  );
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const showsKeys = hasKeyOption && (isApi || hasKeys || isKeyOpen);

  return (
    <div className="flex flex-col gap-6">
      <Band label="Account" ariaLabel="Account">
        {isApi ? <RuntimeRow info={info} /> : <SignedInRow {...props} />}
        {isApi ? null : <CliRow info={info} />}
        {hasKeyOption && !showsKeys ? (
          <button
            type="button"
            onClick={() => setIsKeyOpen(true)}
            className={cn(
              BAND_ROW_CLASS,
              'gap-3 text-left text-label motion-safe:transition-colors hover:bg-hover',
            )}
          >
            <span className="w-28 shrink-0 text-muted-foreground">API key</span>
            <span className="min-w-0 flex-1 truncate text-foreground">
              Use an API key instead of your plan
            </span>
            <ChevronRight size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
          </button>
        ) : null}
      </Band>
      {showsKeys ? <ProviderCredentialsSection providerId={info.id} /> : null}
      <ProviderBindingsSection providerId={info.id} cliIdentity={isApi ? null : info.identity} />
    </div>
  );
};

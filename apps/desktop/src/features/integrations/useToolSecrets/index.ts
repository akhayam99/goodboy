import { useEffect, useRef, useState } from 'react';
import type { IntegrationBinding, IntegrationBindingId } from '@goodboy/types';
import { integrationCredentialHasSecret } from '../credentials';
import { useCredentialRecheck } from '../useCredentialRecheck';
import type { CredentialSecretState } from '../useCredentialSecret';

type Params = {
  readonly integrations: ReadonlyArray<IntegrationBinding>;
  readonly checkedAtMs: number;
};

export type ToolSecrets = Readonly<Record<IntegrationBindingId, CredentialSecretState>>;

const NO_SECRETS: ToolSecrets = {};

export const useToolSecrets = ({ integrations, checkedAtMs }: Params): ToolSecrets => {
  const [secrets, setSecrets] = useState<ToolSecrets>(NO_SECRETS);
  const recheck = useCredentialRecheck();
  const latest = useRef(integrations);
  latest.current = integrations;
  const bindingsKey = integrations
    .map((binding) => `${binding.id}:${binding.credentialId ?? ''}`)
    .join('|');

  useEffect(() => {
    let isCancelled = false;
    const bindings = latest.current.filter((binding) => binding.credentialId != null);
    setSecrets((current) =>
      Object.fromEntries(
        bindings.flatMap((binding) => {
          const known = current[binding.id];
          return known === undefined ? [] : [[binding.id, known]];
        }),
      ),
    );
    bindings.forEach((binding) => {
      if (binding.credentialId == null) {
        return;
      }
      integrationCredentialHasSecret({ credentialId: binding.credentialId })
        .then((hasSecret) => {
          if (isCancelled) {
            return;
          }
          setSecrets((current) => ({
            ...current,
            [binding.id]: hasSecret ? 'present' : 'missing',
          }));
        })
        .catch(() => {
          if (isCancelled) {
            return;
          }
          setSecrets((current) => ({ ...current, [binding.id]: 'unknown' }));
        });
    });
    return () => {
      isCancelled = true;
    };
  }, [bindingsKey, checkedAtMs, recheck]);

  return secrets;
};

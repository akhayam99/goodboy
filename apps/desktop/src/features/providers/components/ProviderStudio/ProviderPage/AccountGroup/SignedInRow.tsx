import { Chip } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../../../store/store';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { useProviderHealth } from '../../../../../../shared/hooks/useProviderHealth';
import { ObjectActionVerb } from '../../../../../actions/ObjectActionVerb';
import { providerAccountChip } from '../../../../providerAccountChip';
import { checkedLine } from '../../../../providerHealthCopy';
import { ConnectionTest } from './ConnectionTest';
import type { AccountGroupProps } from './types';

const CLOCK_MS = 60_000;

type SublineParams = {
  readonly planLabel: string | null;
  readonly checked: string | null;
};

const subline = ({ planLabel, checked }: SublineParams): string | null => {
  const parts = [planLabel === null ? null : `${planLabel} plan`, checked].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? null : parts.join(' · ');
};

export const SignedInRow = ({ info, planLabel, target }: AccountGroupProps) => {
  const health = useProviderHealth({ providerId: info.id });
  const nowMs = useNow(CLOCK_MS);
  const state = useAppStore(
    useShallow((store) => ({
      cliRequirements: store.cliRequirements,
      providerHealth: store.providerHealth,
    })),
  );
  const isTestFailed = useAppStore(
    (store) => store.providerConnectionTests[info.id]?.result?.isOk === false,
  );
  const chip = providerAccountChip({ provider: info, state, nowMs });
  const detail = subline({ planLabel, checked: checkedLine({ health, nowMs }) });
  const isSignInNeeded = chip?.isSignInNeeded === true || isTestFailed;

  return (
    <ConnectionTest info={info}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-foreground">
          {info.identity === null ? 'Connected' : `Signed in as ${info.identity}`}
        </span>
        {detail === null ? null : (
          <span className="truncate text-meta text-muted-foreground">{detail}</span>
        )}
      </span>
      {chip === null ? null : <Chip kind="state" tone={chip.tone} label={chip.label} />}
      {isSignInNeeded ? <ObjectActionVerb target={target} actionId="provider.reauth" /> : null}
    </ConnectionTest>
  );
};

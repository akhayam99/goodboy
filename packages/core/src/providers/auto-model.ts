import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import { getDefaultTurnModel } from './capabilities';
import { resolveRoleRouting } from './role-models';

export type AutoModelChoice = {
  readonly provider: ProviderId;
  readonly model: string;
};

type AutoParams = {
  readonly role: string;
  readonly providers: ReadonlyArray<ProviderId>;
  readonly prefs?: RoleModelPreferences | null;
};

type Params = {
  readonly role: string;
  readonly provider: ProviderId;
  readonly prefs?: RoleModelPreferences | null;
};

export const autoModelForRole = ({
  role,
  providers,
  prefs,
}: AutoParams): AutoModelChoice | null => {
  const [defaultProvider] = providers;
  if (defaultProvider == null) {
    return null;
  }
  const routing = resolveRoleRouting({
    role,
    prefs,
    auto: { defaultProvider, fallbackOrder: providers, connected: providers },
  });
  if (!providers.includes(routing.provider)) {
    return null;
  }
  return { provider: routing.provider, model: routing.model };
};

export const recommendedModelForRole = ({ role, provider, prefs }: Params): string => {
  return (
    autoModelForRole({ role, providers: [provider], prefs })?.model ??
    getDefaultTurnModel({ id: provider })
  );
};

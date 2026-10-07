import type { ProviderId, RoleModelPreferences, StepSize } from '@goodboy/types';
import { getDefaultTurnModel } from './capabilities';
import type { HiddenModels } from './modelVisibility';
import { resolveRoleRouting } from './role-models';

export type AutoModelChoice = {
  readonly provider: ProviderId;
  readonly model: string;
};

type AutoParams = {
  readonly role: string;
  readonly providers: ReadonlyArray<ProviderId>;
  readonly prefs?: RoleModelPreferences | null;
  readonly size?: StepSize | null;
  readonly hidden?: HiddenModels | null;
};

type Params = {
  readonly role: string;
  readonly provider: ProviderId;
  readonly prefs?: RoleModelPreferences | null;
  readonly size?: StepSize | null;
  readonly hidden?: HiddenModels | null;
};

export const autoModelForRole = ({
  role,
  providers,
  prefs,
  size = null,
  hidden = null,
}: AutoParams): AutoModelChoice | null => {
  const [defaultProvider] = providers;
  if (defaultProvider == null) {
    return null;
  }
  const routing = resolveRoleRouting({
    role,
    prefs,
    auto: {
      defaultProvider,
      fallbackOrder: providers,
      connected: providers,
      ...(hidden !== null && { hidden }),
    },
    size,
  });
  if (!providers.includes(routing.provider)) {
    return null;
  }
  return { provider: routing.provider, model: routing.model };
};

export const recommendedModelForRole = ({
  role,
  provider,
  prefs,
  size = null,
  hidden = null,
}: Params): string => {
  return (
    autoModelForRole({ role, providers: [provider], prefs, size, hidden })?.model ??
    getDefaultTurnModel({ id: provider })
  );
};

import type { ProviderId, RoleModelPreferences, StepSize } from '@goodboy/types';
import type { AutoContext } from './autoRouting/autoTypes';
import { getDefaultTurnModel } from './capabilities';
import type { HiddenModels } from './modelVisibility';
import { resolveRoleRouting } from './role-models';

export type AutoModelChoice = {
  readonly provider: ProviderId;
  readonly model: string;
};

type CliContext = Pick<AutoContext, 'cliVersions' | 'learned'>;

type AutoParams = {
  readonly role: string;
  readonly providers: ReadonlyArray<ProviderId>;
  readonly prefs?: RoleModelPreferences | null;
  readonly size?: StepSize | null;
  readonly hidden?: HiddenModels | null;
  readonly cli?: CliContext | null;
};

type Params = {
  readonly role: string;
  readonly provider: ProviderId;
  readonly prefs?: RoleModelPreferences | null;
  readonly size?: StepSize | null;
  readonly hidden?: HiddenModels | null;
  readonly cli?: CliContext | null;
};

export const autoModelForRole = ({
  role,
  providers,
  prefs,
  size = null,
  hidden = null,
  cli = null,
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
      ...(cli?.cliVersions != null && { cliVersions: cli.cliVersions }),
      ...(cli?.learned != null && { learned: cli.learned }),
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
  cli = null,
}: Params): string => {
  return (
    autoModelForRole({ role, providers: [provider], prefs, size, hidden, cli })?.model ??
    getDefaultTurnModel({ id: provider })
  );
};

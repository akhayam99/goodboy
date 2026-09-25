import type { CatalogModel, ModelKey, ProviderId } from '@goodboy/types';
import { MODEL_CATALOGS } from './catalogs';
import { cleanCliVersion, isCliVersionBelow, newestCliVersion } from './cliVersion';

export type CliRequirement = {
  readonly providerId: ProviderId;
  readonly modelKey: ModelKey;
  readonly requiredVersion: string;
};

export type CliGate = {
  readonly provider: ProviderId;
  readonly model: CatalogModel;
  readonly requiredVersion: string;
  readonly installedVersion: string;
};

type CatalogParams = {
  readonly provider: ProviderId;
};

const catalogFor = ({ provider }: CatalogParams): ReadonlyArray<CatalogModel> =>
  MODEL_CATALOGS[provider];

type RequiredParams = {
  readonly model: CatalogModel;
  readonly learned: ReadonlyArray<CliRequirement>;
};

const requiredVersionFor = ({ model, learned }: RequiredParams): string | null => {
  const versions = learned
    .filter((entry) => entry.providerId === model.provider && entry.modelKey === model.key)
    .map((entry) => entry.requiredVersion);
  return newestCliVersion({
    versions: model.minCliVersion === undefined ? versions : [model.minCliVersion, ...versions],
  });
};

type ModelGateParams = {
  readonly model: CatalogModel;
  readonly installedVersion: string | null;
  readonly learned: ReadonlyArray<CliRequirement>;
};

const gateForModel = ({ model, installedVersion, learned }: ModelGateParams): CliGate | null => {
  const installed = cleanCliVersion({ raw: installedVersion });
  const requiredVersion = requiredVersionFor({ model, learned });
  if (installed === null || requiredVersion === null) {
    return null;
  }
  if (!isCliVersionBelow({ installed, required: requiredVersion })) {
    return null;
  }
  return { provider: model.provider, model, requiredVersion, installedVersion: installed };
};

type GateParams = {
  readonly provider: ProviderId;
  readonly modelKey: ModelKey;
  readonly installedVersion: string | null;
  readonly learned: ReadonlyArray<CliRequirement>;
};

export const cliGate = ({
  provider,
  modelKey,
  installedVersion,
  learned,
}: GateParams): CliGate | null => {
  const model = catalogFor({ provider }).find((candidate) => candidate.key === modelKey);
  if (model === undefined) {
    return null;
  }
  return gateForModel({ model, installedVersion, learned });
};

export const cliSupportedSibling = ({
  provider,
  modelKey,
  installedVersion,
  learned,
}: GateParams): CatalogModel | null => {
  const catalog = catalogFor({ provider });
  const current = catalog.find((candidate) => candidate.key === modelKey);
  if (current === undefined) {
    return null;
  }
  const siblings = catalog
    .filter(
      (candidate) =>
        candidate.key !== current.key &&
        candidate.presentation.group === current.presentation.group &&
        candidate.presentation.order < current.presentation.order &&
        gateForModel({ model: candidate, installedVersion, learned }) === null,
    )
    .sort((left, right) => right.presentation.order - left.presentation.order);
  return siblings[0] ?? null;
};

type OutdatedParams = {
  readonly provider: ProviderId;
  readonly installedVersion: string | null;
  readonly learned: ReadonlyArray<CliRequirement>;
};

export const outdatedCliModels = ({
  provider,
  installedVersion,
  learned,
}: OutdatedParams): ReadonlyArray<CliGate> =>
  catalogFor({ provider })
    .map((model) => gateForModel({ model, installedVersion, learned }))
    .filter((gate): gate is CliGate => gate !== null)
    .sort((left, right) => right.model.presentation.order - left.model.presentation.order);

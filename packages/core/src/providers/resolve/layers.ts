import type {
  ProviderId,
  ProviderPolicy,
  RoleModelPreference,
  TaskModelPreference,
} from '@goodboy/types';
import { createKeyedMerge, type KeyedMerged } from '../../settings/createKeyedMerge';
import type { LayerName, ResolveLayer, ResolveLayers, ResolveSlot } from './types';

const mergeRoleModels = createKeyedMerge<RoleModelPreference>();

const mergeTaskModels = createKeyedMerge<TaskModelPreference>();

export type MergedLayers = Readonly<{
  roleModels: KeyedMerged<RoleModelPreference> | null;
  taskModels: KeyedMerged<TaskModelPreference> | null;
  providerPool: ProviderPolicy | null;
  defaultProviderId: ProviderId | null;
}>;

export const mergeLayers = ({ workspace, project, session }: ResolveLayers): MergedLayers => ({
  roleModels: mergeRoleModels({
    layers: [workspace?.roleModels, project?.roleModels, session?.roleModels],
  }),
  taskModels: mergeTaskModels({
    layers: [workspace?.taskModels, project?.taskModels, session?.taskModels],
  }),
  providerPool: session?.providerPool ?? project?.providerPool ?? workspace?.providerPool ?? null,
  defaultProviderId:
    session?.defaultProviderId ??
    project?.defaultProviderId ??
    workspace?.defaultProviderId ??
    null,
});

type NamedLayer = {
  readonly name: LayerName;
  readonly layer: ResolveLayer | null | undefined;
};

type SourceParams = {
  readonly slot: ResolveSlot;
  readonly layers: ResolveLayers;
};

type PinParams = {
  readonly slot: ResolveSlot;
  readonly layer: ResolveLayer | null | undefined;
};

const hasPin = ({ slot, layer }: PinParams) =>
  slot.kind === 'role'
    ? layer?.roleModels?.[slot.id] != null
    : layer?.taskModels?.[slot.id] != null;

export const pinSourceOf = ({ slot, layers }: SourceParams): LayerName | null => {
  const ordered: ReadonlyArray<NamedLayer> = [
    { name: 'session', layer: layers.session },
    { name: 'project', layer: layers.project },
    { name: 'workspace', layer: layers.workspace },
  ];
  return ordered.find(({ layer }) => hasPin({ slot, layer }))?.name ?? null;
};

import {
  resolveSlot,
  type HeadroomMap,
  type Resolution,
  type ResolveLayer,
  type ResolveContext,
  type ResolveLayers,
  type ResolvePins,
  type ResolveSlot,
} from '@goodboy/core';
import type { ProviderId, SessionId, StepSize, WorkspaceId } from '@goodboy/types';
import { selectModelContext, type ModelScope, type ModelState } from './selectModelContext';

type Options = {
  readonly pins?: ResolvePins;
  readonly size?: StepSize | null;
  readonly isAutoOnly?: boolean;
  readonly providers?: ReadonlyArray<ProviderId> | null;
  readonly headroom?: HeadroomMap | null;
};

type Params = Options & {
  readonly state: ModelState;
  readonly sessionId?: SessionId | null;
  readonly workspaceId?: WorkspaceId | null;
  readonly slot: ResolveSlot;
};

type ScopeParams = Options & {
  readonly scope: ModelScope;
  readonly slot: ResolveSlot;
};

type LayerParams = {
  readonly layer: ResolveLayer | null | undefined;
};

const withoutPins = ({ layer }: LayerParams): ResolveLayer | null =>
  layer == null ? null : { ...layer, roleModels: null, taskModels: null };

type AutoLayersParams = {
  readonly layers: ResolveLayers;
};

const autoLayers = ({ layers }: AutoLayersParams): ResolveLayers => ({
  workspace: withoutPins({ layer: layers.workspace }),
  project: withoutPins({ layer: layers.project }),
  session: withoutPins({ layer: layers.session }),
});

type ContextParams = {
  readonly scope: ModelScope;
  readonly providers: ReadonlyArray<ProviderId> | null | undefined;
  readonly headroom: HeadroomMap | null | undefined;
};

const contextOf = ({ scope, providers, headroom }: ContextParams): ResolveContext => ({
  ...scope.context,
  ...(providers != null && {
    connected: (scope.context.connected ?? []).filter((provider) => providers.includes(provider)),
  }),
  ...(headroom != null && { headroom }),
});

export const resolutionOf = ({
  scope,
  slot,
  pins,
  size,
  isAutoOnly,
  providers,
  headroom,
}: ScopeParams): Resolution =>
  resolveSlot({
    slot,
    layers: isAutoOnly === true ? autoLayers({ layers: scope.layers }) : scope.layers,
    context: contextOf({ scope, providers, headroom }),
    ...(pins !== undefined && isAutoOnly !== true && { pins }),
    ...(size !== undefined && { size }),
  });

export const selectResolution = ({
  state,
  sessionId,
  workspaceId,
  slot,
  pins,
  size,
  isAutoOnly,
  providers,
  headroom,
}: Params): Resolution =>
  resolutionOf({
    scope: selectModelContext({ state, workspaceId, sessionId }),
    slot,
    ...(pins !== undefined && { pins }),
    ...(size !== undefined && { size }),
    ...(isAutoOnly !== undefined && { isAutoOnly }),
    ...(providers !== undefined && { providers }),
    ...(headroom !== undefined && { headroom }),
  });

import {
  resolveSlot,
  type Resolution,
  type ResolveLayer,
  type ResolveLayers,
  type ResolvePins,
  type ResolveSlot,
} from '@goodboy/core';
import type { SessionId, StepSize, WorkspaceId } from '@goodboy/types';
import { selectModelContext, type ModelScope, type ModelState } from './selectModelContext';

type Options = {
  readonly pins?: ResolvePins;
  readonly size?: StepSize | null;
  readonly isAutoOnly?: boolean;
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

export const resolutionOf = ({ scope, slot, pins, size, isAutoOnly }: ScopeParams): Resolution =>
  resolveSlot({
    slot,
    layers: isAutoOnly === true ? autoLayers({ layers: scope.layers }) : scope.layers,
    context: scope.context,
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
}: Params): Resolution =>
  resolutionOf({
    scope: selectModelContext({ state, workspaceId, sessionId }),
    slot,
    ...(pins !== undefined && { pins }),
    ...(size !== undefined && { size }),
    ...(isAutoOnly !== undefined && { isAutoOnly }),
  });

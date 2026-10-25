import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { overridesFromWire, type WireOverrides } from './overridesFromWire';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';
import type { WorkspaceWriteQueue } from './workspaceWriteQueue';

export type WorkspaceOverridesPatch = {
  readonly [Key in keyof OverrideSettings]?: OverrideSettings[Key];
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly patch: WorkspaceOverridesPatch;
};

type OverrideKey = keyof OverrideSettings;

type WritableOverrides = { -readonly [Key in keyof OverrideSettings]: OverrideSettings[Key] };

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
  workflowRules: null,
};

type MergeParams = {
  readonly base: OverrideSettings | undefined;
  readonly patch: WorkspaceOverridesPatch;
};

export const mergeWorkspaceOverrides = ({ base, patch }: MergeParams): OverrideSettings => {
  const start = base ?? EMPTY_OVERRIDES;
  const pick = <Key extends OverrideKey>(key: Key): OverrideSettings[Key] =>
    key in patch ? (patch[key] ?? EMPTY_OVERRIDES[key]) : start[key];
  return {
    defaultProviderId: pick('defaultProviderId'),
    defaultBranchPrefix: pick('defaultBranchPrefix'),
    defaultVerbosity: pick('defaultVerbosity'),
    providerBindings: pick('providerBindings'),
    taskModels: pick('taskModels'),
    roleModels: pick('roleModels'),
    parallelAgents: pick('parallelAgents'),
    providerPool: pick('providerPool'),
    attributionFooter: pick('attributionFooter'),
    replyVoice: pick('replyVoice'),
    replyStyleNote: pick('replyStyleNote'),
    replyTemplateFixed: pick('replyTemplateFixed'),
    replyTemplateNoChange: pick('replyTemplateNoChange'),
    resolveOnGithub: pick('resolveOnGithub'),
    resolveCommitStyle: pick('resolveCommitStyle'),
    afterMerge: pick('afterMerge'),
    defaultBranchTemplate: pick('defaultBranchTemplate'),
    workflowRules: pick('workflowRules'),
  };
};

type KeysOfParams<Value extends object> = {
  readonly value: Value;
};

const keysOf = <Value extends object>({
  value,
}: KeysOfParams<Value>): ReadonlyArray<Extract<keyof Value, string>> => {
  const keys: Array<Extract<keyof Value, string>> = [];
  for (const key in value) {
    keys.push(key);
  }
  return keys;
};

type WirePatchParams = {
  readonly applied: OverrideSettings;
  readonly keys: ReadonlyArray<OverrideKey>;
};

const wirePatch = ({ applied, keys }: WirePatchParams): Readonly<Record<string, unknown>> =>
  Object.fromEntries(keys.map((key) => [key, applied[key]]));

type CopyKeyParams<Key extends OverrideKey> = {
  readonly target: WritableOverrides;
  readonly source: OverrideSettings;
  readonly key: Key;
};

const copyKey = <Key extends OverrideKey>({ target, source, key }: CopyKeyParams<Key>): void => {
  target[key] = source[key];
};

type RestoreParams = {
  readonly current: OverrideSettings;
  readonly applied: OverrideSettings;
  readonly confirmed: OverrideSettings;
  readonly keys: ReadonlyArray<OverrideKey>;
};

const restoreKeys = ({ current, applied, confirmed, keys }: RestoreParams): OverrideSettings => {
  const restored: WritableOverrides = { ...current };
  for (const key of keys) {
    if (current[key] === applied[key]) {
      copyKey({ target: restored, source: confirmed, key });
    }
  }
  return restored;
};

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly enqueue: WorkspaceWriteQueue<OverrideSettings>;
};

export const patchWorkspaceOverrides = ({ set, get, enqueue }: Deps) => {
  return async ({ workspaceId, patch }: Params): Promise<void> => {
    const previous = get().workspaceOverrides[workspaceId];
    const applied = mergeWorkspaceOverrides({ base: previous, patch });
    const keys = keysOf({ value: patch });
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: applied },
    }));
    const outcome = await enqueue({
      workspaceId,
      previous,
      persist: async ({ confirmed }) => {
        const stored = await invokeCommand<WireOverrides | null>('patch_workspace_overrides', {
          workspaceId,
          patch: wirePatch({ applied, keys }),
        });
        if (stored == null) {
          return mergeWorkspaceOverrides({ base: confirmed, patch });
        }
        return overridesFromWire({ wire: stored });
      },
    });
    if (outcome.ok) {
      if (outcome.isLast) {
        set((state) => ({
          workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: outcome.stored },
        }));
      }
      return;
    }
    const { confirmed, isLast } = outcome;
    set((state) => {
      const current = state.workspaceOverrides[workspaceId];
      if (current === undefined) {
        return {};
      }
      const isUntouched = keys.every((key) => current[key] === applied[key]);
      if (confirmed === undefined && isLast && isUntouched) {
        const workspaceOverrides = { ...state.workspaceOverrides };
        delete workspaceOverrides[workspaceId];
        return { workspaceOverrides };
      }
      const restored = restoreKeys({
        current,
        applied,
        confirmed: confirmed ?? EMPTY_OVERRIDES,
        keys,
      });
      return { workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: restored } };
    });
    throw outcome.error;
  };
};

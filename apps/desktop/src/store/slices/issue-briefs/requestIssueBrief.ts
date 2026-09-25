import { autoLimitContext } from '../providerLimits/autoLimitContext';
import { resolveLimitedTaskModel } from '../providerLimits/resolveLimitedTaskModel';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE, generateIssueBrief } from '@goodboy/core';
import { invoke } from '@tauri-apps/api/core';
import { routeTaskModel } from '../../../features/providers/taskModelRouting';
import { cutAtBoundary } from '../../../shared/utils/cutAtBoundary';
import {
  selectResolvedSettings,
  selectWorkspaceResolvedSettings,
} from '../overrides/selectResolvedSettings';
import { issueBriefKey } from './issueBriefKey';
import type {
  GetFn,
  IssueBriefEntry,
  IssueBriefSource,
  RequestIssueBriefParams,
  SetFn,
} from './types';

const ISSUE_BRIEF_BODY_CAP = 12_000;

type SignatureParams = {
  readonly source: IssueBriefSource;
};

const briefSignature = ({ source }: SignatureParams): string =>
  `${source.title.trim()}\n${source.body.trim()}`;

type WriteParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly key: string;
  readonly entry: IssueBriefEntry;
};

const writeIfCurrent = ({ set, get, key, entry }: WriteParams): void => {
  if (get().issueBriefs[key]?.signature !== entry.signature) {
    return;
  }
  set((state) => ({ issueBriefs: { ...state.issueBriefs, [key]: entry } }));
};

export const requestIssueBrief = (set: SetFn, get: GetFn) => {
  return async ({
    source,
    workspaceId,
    sessionId,
    isRetry = false,
  }: RequestIssueBriefParams): Promise<void> => {
    const key = issueBriefKey({ source });
    const signature = briefSignature({ source });
    const state = get();
    const existing = state.issueBriefs[key];
    const isReusable =
      existing != null &&
      existing.signature === signature &&
      (existing.status === 'loading' ||
        existing.status === 'ready' ||
        (existing.status === 'failed' && !isRetry));
    if (isReusable) {
      return;
    }

    const session =
      sessionId === null ? null : (state.sessions.find((entry) => entry.id === sessionId) ?? null);
    const settings =
      session === null
        ? selectWorkspaceResolvedSettings({ state, workspaceId })
        : selectResolvedSettings({ state, sessionId: session.id });
    const connectedProviders = state.providers
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id);
    const taskModel = routeTaskModel({
      taskModel: resolveLimitedTaskModel({
        limitContext: autoLimitContext({ state: get() }),
        task: 'issue_brief',
        preferences: settings?.taskModels,
        workspaceDefaultProviderId: settings?.defaultProviderOverride,
        sessionDefaultProviderId:
          session?.providerPreference.defaultProvider ??
          DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
      }),
      connectedProviders,
      enabledProviders: session?.providerPreference.enabledProviders ?? null,
      cooldowns: state.providerCooldowns,
      nowMs: Date.now(),
    });
    if (taskModel == null || !connectedProviders.includes(taskModel.providerId)) {
      if (existing?.status === 'unavailable' && existing.signature === signature) {
        return;
      }
      set((current) => ({
        issueBriefs: { ...current.issueBriefs, [key]: { status: 'unavailable', signature } },
      }));
      return;
    }

    const route = { providerId: taskModel.providerId, model: taskModel.model };
    set((current) => ({
      issueBriefs: { ...current.issueBriefs, [key]: { status: 'loading', signature, route } },
    }));

    const result = await generateIssueBrief({
      deps: { ...taskModel, invokeFn: invoke },
      input: {
        identifier: source.identifier,
        title: source.title,
        body: cutAtBoundary({ text: source.body.trim(), capChars: ISSUE_BRIEF_BODY_CAP }).text,
      },
    });
    if (result.kind === 'failed') {
      writeIfCurrent({
        set,
        get,
        key,
        entry: {
          status: 'failed',
          signature,
          route,
          failure: result.failure,
          detail: result.detail,
        },
      });
      return;
    }
    writeIfCurrent({
      set,
      get,
      key,
      entry: {
        status: 'ready',
        signature,
        route,
        brief: result.brief,
        durationMs: result.durationMs,
        costUsd: result.costUsd,
      },
    });
  };
};

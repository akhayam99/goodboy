import { generateIssueBrief } from '@goodboy/core';
import { selectTaskModel } from '../models/selectTaskModel';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { routeTaskModel } from '../../../features/providers/taskModelRouting';
import { cutAtBoundary } from '../../../shared/utils/cutAtBoundary';
import { issueBriefKey } from './issueBriefKey';
import type {
  GetFn,
  IssueBriefEntry,
  IssueBriefSource,
  RequestIssueBriefParams,
  SetFn,
} from './types';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import { createLatestOnly } from '../state-writes/latestOnly';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { liveEnabledProviders } from '../models/liveEnabledProviders';

const ISSUE_BRIEF_BODY_CAP = 12_000;

type SignatureParams = {
  readonly sources: ReadonlyArray<IssueBriefSource>;
};

const briefSignature = ({ sources }: SignatureParams): string => {
  const single = sources.length === 1 ? sources[0] : undefined;
  if (single !== undefined) {
    return `${single.title.trim()}\n${single.body.trim()}`;
  }
  return JSON.stringify(
    [...sources]
      .sort(
        (left, right) =>
          left.identifier.localeCompare(right.identifier) ||
          left.provider.localeCompare(right.provider) ||
          left.externalId.localeCompare(right.externalId),
      )
      .map((source) => [
        source.provider,
        source.externalId,
        source.identifier.trim(),
        source.title.trim(),
        source.body.trim(),
      ]),
  );
};

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

type Params = { readonly set: SetFn; readonly get: GetFn };

export const requestIssueBrief = ({ set, get }: Params) => {
  const latest = createLatestOnly();
  return async ({
    sources,
    workspaceId,
    sessionId,
    isRetry = false,
  }: RequestIssueBriefParams): Promise<void> => {
    const key = issueBriefKey({ sources });
    const signature = briefSignature({ sources });
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

    const connectedProviders = autoRoutableProviders({ providers: state.providers });
    const taskModel = routeTaskModel({
      taskModel: selectTaskModel({ state, sessionId, workspaceId, task: 'issue_brief' }),
      connectedProviders,
      enabledProviders: liveEnabledProviders({ state, sessionId, workspaceId }) ?? null,
      cooldowns: state.providerCooldowns,
      hidden: selectHiddenModels({ state }),
      nowMs: Date.now(),
    });
    if (taskModel == null || !connectedProviders.includes(taskModel.providerId)) {
      latest.cancel({ key });
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

    await latest.run({
      key,
      request: () =>
        generateIssueBrief({
          deps: { ...taskModel, invokeFn: invokeCommand },
          input: {
            items: sources.map((source) => ({
              identifier: source.identifier,
              title: source.title,
              body: cutAtBoundary({ text: source.body.trim(), capChars: ISSUE_BRIEF_BODY_CAP })
                .text,
            })),
          },
        }),
      apply: (result) => {
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
      },
    });
  };
};

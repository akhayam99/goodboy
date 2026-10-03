import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { normalizeWorkspaceProfile } from '../../../shared/utils/normalizeWorkspaceProfile';
import { editPostedReplyKey } from '../../resolve/editPostedReplySetting';
import { isWorkspaceOwnedOverride, pageKeys, type WorkspaceSettingField } from '../pageKeys';
import { WORKSPACE_PAGES, type WorkspacePage } from '../components/SettingsStudio/workspacePages';
import { effectiveValue, fieldDef, isChanged, sameValue } from './fields';
import {
  mergeWrites,
  type WorkspaceSettingsSnapshot,
  type WorkspaceSettingsWrite,
} from './snapshot';

export type PlanScope = 'all' | WorkspacePage;

export type PlanItem = {
  readonly field: WorkspaceSettingField;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly write: Partial<WorkspaceSettingsWrite>;
  readonly undo: Partial<WorkspaceSettingsWrite>;
};

export type PagePlan = {
  readonly page: WorkspacePage;
  readonly items: ReadonlyArray<PlanItem>;
};

const scopePages = ({ scope }: { readonly scope: PlanScope }): ReadonlyArray<WorkspacePage> =>
  (scope === 'all' ? WORKSPACE_PAGES.map((entry) => entry.id) : [scope]).filter(
    (page) => pageKeys({ page }).length > 0,
  );

const byPage = ({
  scope,
  itemOf,
}: {
  readonly scope: PlanScope;
  readonly itemOf: (field: WorkspaceSettingField) => PlanItem | null;
}): ReadonlyArray<PagePlan> =>
  scopePages({ scope })
    .map((page) => ({
      page,
      items: pageKeys({ page })
        .map(itemOf)
        .filter((item): item is PlanItem => item !== null),
    }))
    .filter((plan) => plan.items.length > 0);

export const copyPlan = ({
  scope,
  current,
  source,
}: {
  readonly scope: PlanScope;
  readonly current: WorkspaceSettingsSnapshot;
  readonly source: WorkspaceSettingsSnapshot;
}): ReadonlyArray<PagePlan> =>
  byPage({
    scope,
    itemOf: (field) => {
      const def = fieldDef({ field });
      const next = def.stored(source);
      const now = effectiveValue({ def, snapshot: current });
      if (next === null || sameValue(next, now)) {
        return null;
      }
      return {
        field,
        label: def.label,
        from: def.display(now),
        to: def.display(next),
        write: def.write(next),
        undo: def.write(def.stored(current)),
      };
    },
  });

export const restorePlan = ({
  scope,
  current,
}: {
  readonly scope: PlanScope;
  readonly current: WorkspaceSettingsSnapshot;
}): ReadonlyArray<PagePlan> =>
  byPage({
    scope,
    itemOf: (field) => {
      const def = fieldDef({ field });
      if (!isChanged({ def, snapshot: current })) {
        return null;
      }
      return {
        field,
        label: def.label,
        from: def.display(effectiveValue({ def, snapshot: current })),
        to: def.display(def.fallback),
        write: def.write(null),
        undo: def.write(def.stored(current)),
      };
    },
  });

export const planSize = ({ plan }: { readonly plan: ReadonlyArray<PagePlan> }): number =>
  plan.reduce((count, page) => count + page.items.length, 0);

export type ApplyState = Pick<
  AppStore,
  | 'workspaces'
  | 'patchWorkspaceOverrides'
  | 'updateWorkspaceProfile'
  | 'setWorkspacePermissionDefault'
  | 'saveSetting'
>;

export const applyWorkspaceSettings = async ({
  state,
  workspaceId,
  writes,
}: {
  readonly state: ApplyState;
  readonly workspaceId: WorkspaceId;
  readonly writes: ReadonlyArray<Partial<WorkspaceSettingsWrite>>;
}): Promise<void> => {
  const write = mergeWrites({ writes });
  const patch = Object.fromEntries(
    Object.entries(write.overrides).filter(([key]) => isWorkspaceOwnedOverride(key)),
  );
  if (Object.keys(patch).length > 0) {
    await state.patchWorkspaceOverrides({ workspaceId, patch });
  }
  if (Object.keys(write.profile).length > 0) {
    const workspace = state.workspaces.find((candidate) => candidate.id === workspaceId);
    const base = normalizeWorkspaceProfile({ profile: workspace?.profile });
    await state.updateWorkspaceProfile({
      workspaceId,
      profile: normalizeWorkspaceProfile({ profile: { ...base, ...write.profile } }),
    });
  }
  if (write.permissionMode !== null) {
    await state.setWorkspacePermissionDefault({ workspaceId, mode: write.permissionMode });
  }
  if (write.editPostedReply !== null) {
    await state.saveSetting(editPostedReplyKey({ workspaceId }), write.editPostedReply);
  }
};

import type { ComponentProps, ReactNode } from 'react';
import type { AutoLevel } from '@goodboy/core/auto';
import type {
  ClaudePermissionMode,
  SessionId,
  WorkflowAutonomy,
  WorkspaceId,
} from '@goodboy/types';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import type { AutoLimitKind } from '../../../auto/autoLimitCopy';
import { AutoLevelChip } from '../../../auto/level/AutoLevelChip';
import { openRunDefaults } from '../../../settings/openRunDefaults';
import type { AgentKind } from '../../agent-kind';
import { StartAsksSetting } from '../SessionKickoff/StartAsksSetting';
import { StartRoleField } from '../SessionKickoff/StartRoleField';
import type { RunModelView } from '../StartRun/useRunModel';
import { StartEditsSetting } from './StartEditsSetting';
import { StartGuidanceSetting } from './StartGuidanceSetting';
import type { StartFormKind } from './startFormKinds';
import type { StartAsksKind, StartGuidanceReader } from './startFormWords';
import { startSettingsOf, type StartSettingItem } from './startSettingsOf';

type NextParams<Value> = {
  readonly next: Value;
};

type LimitView = ComponentProps<typeof AutoLimitChip>['limit'];

type Params = {
  readonly kind: StartFormKind | null;
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly workspaceName: string;
  readonly isDisabled: boolean;
  readonly model: RunModelView;
  readonly where: ReactNode;
  readonly role: {
    readonly value: AgentKind;
    readonly onChange: (params: NextParams<AgentKind>) => void;
  } | null;
  readonly asks: StartAsksKind | null;
  readonly level: {
    readonly value: AutoLevel;
    readonly workspaceLevel: AutoLevel;
    readonly onPick: (params: NextParams<AutoLevel>) => void;
  };
  readonly autonomy: {
    readonly value: WorkflowAutonomy;
    readonly onPick: (params: NextParams<WorkflowAutonomy>) => void;
  };
  readonly edits: {
    readonly value: ClaudePermissionMode | null;
    readonly onPick: (params: NextParams<ClaudePermissionMode>) => void;
  };
  readonly guidance: {
    readonly value: string | null;
    readonly reader: StartGuidanceReader;
    readonly onPick: (params: NextParams<string | null>) => void;
  };
  readonly limit: {
    readonly view: LimitView;
    readonly kind: AutoLimitKind | null;
  };
};

export const startSettingItemsOf = ({
  kind,
  workspaceId,
  sessionId,
  workspaceName,
  isDisabled,
  model,
  where,
  role,
  asks,
  level,
  autonomy,
  edits,
  guidance,
  limit,
}: Params): ReadonlyArray<StartSettingItem> =>
  startSettingsOf({
    kind,
    changed: [
      ...(asks === 'level' && level.value !== level.workspaceLevel ? (['asks'] as const) : []),
      ...(limit.kind !== null && !limit.view.isDefault ? (['limit'] as const) : []),
      ...(guidance.value !== null ? (['guidance'] as const) : []),
    ],
    nodes: {
      where,
      role:
        role === null ? null : (
          <StartRoleField
            value={role.value}
            isDisabled={isDisabled}
            onChange={(next) => role.onChange({ next })}
          />
        ),
      asks:
        asks === 'level' ? (
          <AutoLevelChip
            value={level.value}
            workspaceLevel={level.workspaceLevel}
            error={null}
            workspaceName={workspaceName}
            isDisabled={isDisabled}
            permissions={{ workspaceId, sessionId, treeId: null }}
            onPick={level.onPick}
          />
        ) : asks === 'steps' ? (
          <StartAsksSetting
            workspaceId={workspaceId}
            autonomy={autonomy.value}
            isDisabled={isDisabled}
            onPick={autonomy.onPick}
          />
        ) : null,
      edits: (
        <StartEditsSetting
          workspaceId={workspaceId}
          sessionId={sessionId}
          picked={edits.value}
          provider={model.effective.provider}
          isDisabled={isDisabled}
          onPick={edits.onPick}
        />
      ),
      limit:
        limit.kind === null ? null : (
          <AutoLimitChip
            limit={limit.view}
            kind={limit.kind}
            isDisabled={isDisabled}
            onChangeDefault={openRunDefaults}
          />
        ),
      guidance: (
        <StartGuidanceSetting
          workspaceId={workspaceId}
          picked={guidance.value}
          reader={guidance.reader}
          isDisabled={isDisabled}
          onPick={guidance.onPick}
        />
      ),
    },
  });

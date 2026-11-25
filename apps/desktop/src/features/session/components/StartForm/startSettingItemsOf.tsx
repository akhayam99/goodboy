import type { ComponentProps, ReactNode } from 'react';
import type { AutoLevel } from '@goodboy/core/auto';
import type {
  ClaudePermissionMode,
  SessionId,
  WorkflowAutonomy,
  WorkflowSpendLimitMode,
  WorkspaceId,
} from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import type { AutoLimitKind } from '../../../auto/autoLimitCopy';
import { AutoLevelChip } from '../../../auto/level/AutoLevelChip';
import type { PickerMode } from '../../../permissions/modeCopy';
import { openRunDefaults } from '../../../settings/openRunDefaults';
import { StartAsksSetting } from '../SessionKickoff/StartAsksSetting';
import type { RunModelView } from '../StartRun/useRunModel';
import { StartEditsSetting } from './StartEditsSetting';
import { StartGuidanceSetting } from './StartGuidanceSetting';
import { StartRepliesChip } from './StartRepliesChip';
import type { StartFormKind } from './startFormKinds';
import type { StartAsksKind, StartGuidanceReader } from './startFormWords';
import { startSettingsOf, type StartSettingItem } from './startSettingsOf';
import { startSettingWordsOf } from './startSettingWordsOf';

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
  readonly where: {
    readonly node: ReactNode;
    readonly names: ReadonlyArray<string> | null;
  };
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
    readonly mode: PickerMode;
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
    readonly mode: WorkflowSpendLimitMode;
  };
  readonly replies: string;
};

type AsksAutonomyParams = {
  readonly asks: StartAsksKind | null;
  readonly level: AutoLevel;
  readonly autonomy: WorkflowAutonomy;
};

const asksAutonomyOf = ({ asks, level, autonomy }: AsksAutonomyParams): WorkflowAutonomy | null => {
  if (asks === null) {
    return null;
  }
  return asks === 'level' ? level : autonomy;
};

export const startSettingItemsOf = ({
  kind,
  workspaceId,
  sessionId,
  workspaceName,
  isDisabled,
  model,
  where,
  asks,
  level,
  autonomy,
  edits,
  guidance,
  limit,
  replies,
}: Params): ReadonlyArray<StartSettingItem> =>
  startSettingsOf({
    kind,
    changed: [
      ...(asks === 'level' && level.value !== level.workspaceLevel ? (['asks'] as const) : []),
      ...(limit.kind !== null && !limit.view.isDefault ? (['limit'] as const) : []),
      ...(guidance.value !== null ? (['guidance'] as const) : []),
    ],
    words: startSettingWordsOf({
      autonomy: asksAutonomyOf({ asks, level: level.value, autonomy: autonomy.value }),
      editsMode: edits.mode,
      limitUsd: limit.view.usd,
      limitMode: limit.kind === 'autoAgent' ? 'pause' : limit.mode,
      replies,
      hasOwnGuidance: guidance.value !== null,
      projectNames: where.names,
    }),
    nodes: {
      where: where.node,
      asks:
        asks === 'level' ? (
          <AutoLevelChip
            label={NAMES.stops}
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
      replies: <StartRepliesChip value={replies} isDisabled={isDisabled} />,
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

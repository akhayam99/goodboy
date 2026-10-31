import type { WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../../store';
import { workspaceRulesFor } from './workspaceRulesFor';
import { runLimitOf } from './runLimitOf';

type Params = {
  readonly state: Pick<AppStore, 'workspaceOverrides'>;
  readonly workspaceId: WorkspaceId;
};

export const runDefaultLimitOf = ({ state, workspaceId }: Params): number | null =>
  runLimitOf({
    rules: workspaceRulesFor({ state, workspaceId }),
    spendLimitUsd: undefined,
    limitSource: undefined,
  }).usd;

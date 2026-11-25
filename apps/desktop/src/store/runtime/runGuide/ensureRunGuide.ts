import { startGuideRecord, type GuideChoice, type GuideRecord } from '@goodboy/core/auto';
import {
  getAutoTree,
  getSessionById,
  getSetting,
  listAutoDelegations,
  listWorkflows,
  type Database,
} from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { parseRunRoutes, runRoutesKey } from '../../../features/session/startRun/runRoutesSetting';
import { readRunGuide, readRunGuideRaw } from './readRunGuide';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const ensureRunGuide = async ({ db, treeId }: Params): Promise<GuideRecord | null> => {
  const raw = await readRunGuideRaw({ db, treeId });
  if (raw !== null) {
    return readRunGuide({ db, treeId });
  }
  const tree = await getAutoTree({ db, treeId });
  if (tree === null) {
    return null;
  }
  const session = await getSessionById(db, tree.sessionId);
  if (session === null) {
    return null;
  }
  const route =
    parseRunRoutes({ raw: await getSetting(db, runRoutesKey({ sessionId: tree.sessionId })) })[
      tree.rootAgentId
    ] ?? null;
  if (route === null || route.shape !== 'lead' || route.role !== null) {
    return null;
  }
  const presets = (await listWorkflows(db, session.workspaceId)).filter(
    (workflow) => workflow.isPreset === true,
  );
  const workflow =
    presets.find(
      (candidate) => route.workflowId !== undefined && candidate.id === route.workflowId,
    ) ?? presets.find((candidate) => candidate.name === route.presetName);
  if (workflow === undefined) {
    return null;
  }
  const choices: ReadonlyArray<GuideChoice> = presets
    .filter((candidate) => candidate.id !== workflow.id)
    .map((candidate) => ({ id: candidate.id, name: candidate.name }));
  const suggested =
    workflow.thenSuggestId == null
      ? undefined
      : choices.find((choice) => choice.id === workflow.thenSuggestId);
  const delegations = await listAutoDelegations({ db, treeId });
  const record = startGuideRecord({
    workflowId: workflow.id,
    name: workflow.name,
    entryCheck: workflow.entryCheck ?? '',
    stopRule: workflow.stopRule ?? '',
    suggestion: suggested ?? null,
    isOrderKept: (route.closeness ?? 'follow') === 'follow',
    steps: workflow.steps.map((step) => ({ name: step.name, role: step.role ?? null })),
    choices,
    isUnderway: delegations.length > 0,
  });
  await db.execute('UPDATE auto_trees SET guide = ? WHERE id = ? AND guide IS NULL', [
    JSON.stringify(record),
    treeId,
  ]);
  return readRunGuide({ db, treeId });
};

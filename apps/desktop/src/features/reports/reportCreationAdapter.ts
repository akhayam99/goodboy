import {
  artifactSpawnBrief,
  artifactSpawnMountIds,
  artifactSpawnScope,
  type ArtifactCreationAdapter,
} from '../artifacts/artifactCreationAdapter';
import { resolveReportRouting } from '../../store/slices/artifacts/spawnReportAgent';
import { REPORT_DEFAULT_REQUEST } from './buildReportContext';
import { asReportType, REPORT_TYPES, REPORT_TYPE_HINT, REPORT_TYPE_LABEL } from './reportTypes';

const choiceOf = ({ draft }: Parameters<ArtifactCreationAdapter['choiceOf']>[0]): string =>
  draft.kind === 'report' ? draft.reportType : 'session-summary';

export const reportCreationAdapter: ArtifactCreationAdapter = {
  kind: 'report',
  crumbLabel: 'Create report',
  generateLabel: 'Generate report',
  ctaTitle: 'Write a report from what this session did',
  brief: { label: 'Brief', placeholder: 'What should this report explain?' },
  choice: {
    label: 'Report type',
    ariaLabel: 'Report type',
    options: REPORT_TYPES.map((reportType) => ({
      value: reportType,
      label: REPORT_TYPE_LABEL[reportType],
      hint: REPORT_TYPE_HINT[reportType],
    })),
  },
  scopeCopy: {
    session: 'Everything below comes from the whole session.',
    run: 'Agents and artifacts come from this run. Session events, checks and the local change are session wide either way.',
  },
  defaultRequest: ({ choice }) =>
    REPORT_DEFAULT_REQUEST({ reportType: asReportType({ value: choice }) ?? 'session-summary' }),
  repoLine: ({ repo }) => {
    if (repo === null) {
      return 'No project in this session, so no local change evidence.';
    }
    const branch = repo.branch === null ? 'a detached head' : repo.branch;
    return `Local change evidence from ${repo.mountName} on ${branch}, against ${repo.baseBranch}.`;
  },
  choiceOf,
  withChoice: ({ draft, choice }) => {
    const reportType = asReportType({ value: choice });
    if (draft.kind !== 'report' || reportType === null) {
      return draft;
    }
    return { ...draft, reportType };
  },
  resolveRouting: ({ state, sessionId }) =>
    resolveReportRouting({ state, sessionId, picked: null }),
  spawn: ({ actions, sessionId, draft }) =>
    actions.spawnReportAgent({
      sessionId,
      reportType: asReportType({ value: choiceOf({ draft }) }) ?? 'session-summary',
      workflowRunId: artifactSpawnScope({ draft }),
      routing: draft.routing,
      brief: artifactSpawnBrief({ draft }),
      attachments: draft.attachments,
      mountIds: artifactSpawnMountIds({ draft }),
      focus: 'none',
    }),
};

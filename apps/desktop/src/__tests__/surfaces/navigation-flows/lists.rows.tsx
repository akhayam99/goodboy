import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { AgentId, ArtifactId, IsoDateTime, ReportArtifact, SessionId } from '@goodboy/types';
import {
  type BridgeArgs,
  type Row,
  WAIT,
  bridge,
  click,
  clickButton,
  heading,
  openCrumb,
  useAppStore,
} from './harness';

const REPORT_AT: IsoDateTime = JSON.parse(JSON.stringify('2026-09-14T16:27:00.000Z'));
const REPORT_ID: ArtifactId = JSON.parse(JSON.stringify('lists-journey-report'));
const REPORT_AGENT_ID: AgentId = JSON.parse(JSON.stringify('lists-journey-report-agent'));
const REPORT_TITLE = 'Webhook retries credit once';

const reportOf = ({ sessionId }: { readonly sessionId: SessionId }): ReportArtifact => ({
  id: REPORT_ID,
  sessionId,
  agentId: REPORT_AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: REPORT_TITLE,
  sourceFormat: 'markdown',
  sourceText: '## Summary\n\nThe handler checks the event id inside the transaction.\n',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: REPORT_AT,
  updatedAt: REPORT_AT,
  openedAt: null,
});

let reportStatus = 'active';

export const resetListsBridge = (): void => {
  reportStatus = 'active';
};

const reportRow = ({ sessionId }: { readonly sessionId: string }) => ({
  id: REPORT_ID,
  session_id: sessionId,
  agent_id: REPORT_AGENT_ID,
  workflow_run_id: null,
  kind: 'report',
  schema_version: 1,
  title: REPORT_TITLE,
  source_format: 'markdown',
  source_text: '## Summary\n\nThe handler checks the event id inside the transaction.\n',
  metadata_json: JSON.stringify({ reportType: 'session-summary' }),
  status: reportStatus,
  revision: 1,
  source_turn_id: null,
  created_at: Date.parse(REPORT_AT),
  updated_at: Date.parse(REPORT_AT),
  opened_at: null,
});

export const listsBridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  const sql = args?.sql ?? '';
  const params = args?.params ?? [];
  if (command === 'db_execute' && /UPDATE session_artifacts SET status = \?/.test(sql)) {
    const [status] = params;
    reportStatus = typeof status === 'string' ? status : reportStatus;
    return Promise.resolve({ rowsAffected: 1 });
  }
  if (command === 'db_select' && /FROM session_artifacts WHERE session_id = \?/.test(sql)) {
    return Promise.resolve([reportRow({ sessionId: String(params[0]) })]);
  }
  if (command === 'db_select' && /FROM plan_consumptions/.test(sql)) {
    return Promise.resolve([]);
  }
  return bridge(command, args);
};

const rowTitled = (title: string): HTMLElement | null =>
  screen.queryByRole('button', { name: new RegExp(`^Report ${title}`) });

export const LISTS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'An artifact row deletes from its overflow menu, and Undo puts it back',
    covers: ['lists:artifact-row-delete-undo'],
    open: async (ctx) => {
      const sessionArtifacts = useAppStore.getState().sessionArtifacts;
      useAppStore.setState({
        sessionArtifacts: { ...sessionArtifacts, [ctx.sessionId]: [reportOf(ctx)] },
      });
      await openCrumb(/^Artifacts/);
      await heading('Artifacts');
      await screen.findByRole('button', { name: new RegExp(`^Report ${REPORT_TITLE}`) }, WAIT);
    },
    lands: async () => {
      expect(screen.queryByRole('button', { name: `Delete ${REPORT_TITLE}` })).toBeNull();

      await clickButton(`More for ${REPORT_TITLE}`);
      await click(await screen.findByRole('menuitem', { name: /^Delete\b/ }));
      await waitFor(() => expect(rowTitled(REPORT_TITLE)).toBeNull(), WAIT);

      await clickButton('Undo');
      await waitFor(() => expect(rowTitled(REPORT_TITLE)).not.toBeNull(), WAIT);
    },
  },
];

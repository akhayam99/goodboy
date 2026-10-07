import { expect } from 'vitest';
import { screen } from '@testing-library/react';
import type { AgentId, ArtifactId, IsoDateTime, ReportArtifact, SessionId } from '@goodboy/types';
import { type Row, WAIT, click, clickButton, heading, openCrumb, useAppStore } from './harness';

const REPORT_AT: IsoDateTime = JSON.parse(JSON.stringify('2026-09-14T16:27:00.000Z'));
const REPORT_ID: ArtifactId = JSON.parse(JSON.stringify('states-journey-report'));
const REPORT_AGENT_ID: AgentId = JSON.parse(JSON.stringify('states-journey-report-agent'));

const reportOf = ({ sessionId }: { readonly sessionId: SessionId }): ReportArtifact => ({
  id: REPORT_ID,
  sessionId,
  agentId: REPORT_AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Retried webhooks no longer double credit',
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

export const STATES_ROWS: ReadonlyArray<Row> = [
  {
    name: 'Artifacts filtered to nothing offers Clear filter, and it restores the list',
    covers: ['states:artifacts-clear-filter'],
    open: async (ctx) => {
      const sessionArtifacts = useAppStore.getState().sessionArtifacts;
      useAppStore.setState({
        sessionArtifacts: { ...sessionArtifacts, [ctx.sessionId]: [reportOf(ctx)] },
      });
      await openCrumb(/^Artifacts/);
      await heading('Artifacts');
      await click(await screen.findByRole('tab', { name: /^Plans/ }));
    },
    lands: async () => {
      expect(await screen.findByText('No plans in this session.', {}, WAIT)).toBeDefined();
      expect(screen.queryByTestId('artifact-list')).toBeNull();

      await clickButton('Clear filter');

      expect(await screen.findByTestId('artifact-list', {}, WAIT)).toBeDefined();
      expect(screen.queryByText('No plans in this session.')).toBeNull();
    },
  },
];

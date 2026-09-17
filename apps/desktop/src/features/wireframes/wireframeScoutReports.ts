import type { Agent, AgentId } from '@goodboy/types';
import { redactSecrets } from '../../shared/utils/redactSecrets';
import {
  citedPathHeader,
  isCitedPathMajorityVerified,
  type CitedPathVerification,
} from '../artifacts/citedPaths';
import type { WireframeScout } from './wireframeScoutRoles';

export const WIREFRAME_SCOUT_LIMITS = {
  reportText: 4_000,
  section: 9_000,
} as const;

export const WIREFRAME_SCOUT_DEADLINE_MS = 360_000;

export const WIREFRAME_SCOUT_CLAMP_NOTE = '\n...\nthis report was clamped to fit the pack.\n';

export const WIREFRAME_SCOUT_DEADLINE_REASON = 'the six minute bound ran out before it reported';

export const WIREFRAME_SCOUT_RESTART_REASON = 'the app restarted before this scout finished';

export const WIREFRAME_SCOUT_DEMOTION_REASON =
  'most of what it reported could not be found on disk';

export const WIREFRAME_SCOUT_NOTHING_USABLE =
  'scouting produced nothing usable, so this wireframe is drawn from the evidence below alone.';

export const WIREFRAME_SCOUT_HEARSAY_RULE =
  'a claim whose only support is a missing path is hearsay: never a screen, never a theme value, at most a node note. open a cited file before you draw a screen from it.';

type ClampParams = Readonly<{
  text: string;
}>;

export const clampWireframeScoutReport = ({ text }: ClampParams): string => {
  const collapsed = text.trim();
  if (collapsed.length <= WIREFRAME_SCOUT_LIMITS.reportText) {
    return collapsed;
  }
  return `${collapsed.slice(0, WIREFRAME_SCOUT_LIMITS.reportText)}${WIREFRAME_SCOUT_CLAMP_NOTE}`;
};

export type WireframeScoutReportState = 'reported' | 'empty' | 'failed' | 'timed-out';

export type WireframeScoutReport = Readonly<{
  scout: WireframeScout;
  agentId: AgentId | null;
  state: WireframeScoutReportState;
  text: string;
  reason: string | null;
}>;

type CollectParams = Readonly<{
  scouts: ReadonlyArray<WireframeScout>;
  children: ReadonlyArray<Agent>;
}>;

const reportOf = ({
  scout,
  child,
}: Readonly<{ scout: WireframeScout; child: Agent | undefined }>): WireframeScoutReport => {
  if (child === undefined) {
    return {
      scout,
      agentId: null,
      state: 'failed',
      text: '',
      reason: 'this scout was never started',
    };
  }
  const summary = child.outputSummary?.trim() ?? '';
  if (child.status === 'skipped') {
    return {
      scout,
      agentId: child.id,
      state: 'timed-out',
      text: '',
      reason: summary.length === 0 ? WIREFRAME_SCOUT_DEADLINE_REASON : summary,
    };
  }
  if (child.status === 'failed') {
    return {
      scout,
      agentId: child.id,
      state: 'failed',
      text: '',
      reason: summary.length === 0 ? 'this scout failed before it reported' : summary,
    };
  }
  if (summary.length === 0) {
    return {
      scout,
      agentId: child.id,
      state: 'empty',
      text: '',
      reason: 'this scout ended its turn without writing anything',
    };
  }
  return { scout, agentId: child.id, state: 'reported', text: summary, reason: null };
};

export const collectWireframeScoutReports = ({
  scouts,
  children,
}: CollectParams): ReadonlyArray<WireframeScoutReport> =>
  scouts.map((scout) =>
    reportOf({ scout, child: children.find((child) => child.name === scout.name) }),
  );

export type WireframeScoutSectionEntry = Readonly<{
  name: string;
  header: string | null;
  body: string | null;
  note: string | null;
}>;

type EntryParams = Readonly<{
  report: WireframeScoutReport;
  verification: CitedPathVerification | null;
}>;

export const wireframeScoutSectionEntry = ({
  report,
  verification,
}: EntryParams): WireframeScoutSectionEntry => {
  if (report.state !== 'reported') {
    return { name: report.scout.name, header: null, body: null, note: report.reason };
  }
  if (verification !== null && !isCitedPathMajorityVerified({ verification })) {
    return {
      name: report.scout.name,
      header: citedPathHeader({ verification }),
      body: null,
      note: WIREFRAME_SCOUT_DEMOTION_REASON,
    };
  }
  return {
    name: report.scout.name,
    header: verification === null ? null : citedPathHeader({ verification }),
    body: redactSecrets({ text: clampWireframeScoutReport({ text: report.text }) }),
    note: null,
  };
};

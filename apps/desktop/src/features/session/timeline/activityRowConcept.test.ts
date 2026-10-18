// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  FileText,
  GitBranch,
  GitGraph,
  MessageSquareCheck,
  MessageSquareReply,
  Network,
  Bot,
  PanelsTopLeft,
  Waypoints,
} from 'lucide-react';
import type { SessionEventKind } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { PULL_REQUEST_PRESENTATION } from '../../../shared/pullRequestPresentation';
import { RUN_KIND_GLYPH } from '../components/SessionWorkspace/parts/TimelinePane/runKindGlyph';
import { activityRowConcept, type ActivityRowKind } from './activityRowConcept';
import { sessionEventGlyph } from './sessionEventPresentation';

const EXPECTED = {
  'workflow-run': Waypoints,
  'orchestrated-run': Network,
  'fix-run': MessageSquareReply,
  agent: Bot,
  question: CircleHelp,
  'question-answered': MessageSquareCheck,
  rebase: GitGraph,
  plan: ClipboardList,
  report: FileText,
  wireframe: PanelsTopLeft,
  learning: BookOpen,
  branch: GitBranch,
} satisfies Record<ActivityRowKind, LucideIcon>;

const KINDS = Object.keys(EXPECTED).filter((kind): kind is ActivityRowKind => kind in EXPECTED);

const CONCEPT_GLYPHS: ReadonlySet<LucideIcon> = new Set(Object.values(CONCEPT_ICONS));

type EventGlyphSource = 'concept' | 'pull-request';

const EVENT_GLYPH_SOURCE = {
  worktree_created: 'concept',
  branch_created: 'concept',
  branch_switched: 'concept',
  branch_deleted: 'concept',
  branch_restored: 'concept',
  issue_linked: 'concept',
  issue_unlinked: 'concept',
  workflow_started: 'concept',
  workflow_discarded: 'concept',
  workflow_restored: 'concept',
  workflow_closed: 'concept',
  workflow_deleted: 'concept',
  decisions_changed: 'concept',
  project_materialized: 'concept',
  project_materialization_refused: 'concept',
  project_materialization_proposed: 'concept',
  project_materialization_dismissed: 'concept',
  project_detached: 'concept',
  external_task_created: 'concept',
  rebase_requested: 'concept',
  session_archived: 'concept',
  session_restored: 'concept',
  write_destination_changed: 'concept',
  question_dismissed: 'concept',
  question_restored: 'concept',
  history_rewritten: 'concept',
  history_pushed: 'concept',
  history_stopped: 'concept',
  history_restored: 'concept',
  pr_created: 'pull-request',
  pr_discovered: 'pull-request',
  pr_ready: 'pull-request',
  pr_approved: 'pull-request',
  pr_merged: 'pull-request',
  pr_closed: 'pull-request',
} satisfies Record<SessionEventKind, EventGlyphSource>;

const EVENT_KINDS = Object.keys(EVENT_GLYPH_SOURCE).filter(
  (kind): kind is SessionEventKind => kind in EVENT_GLYPH_SOURCE,
);

const PULL_REQUEST_GLYPHS: ReadonlySet<LucideIcon> = new Set(
  Object.values(PULL_REQUEST_PRESENTATION).map((presentation) => presentation.icon),
);

const GLYPHS_BY_SOURCE: Readonly<Record<EventGlyphSource, ReadonlySet<LucideIcon>>> = {
  concept: CONCEPT_GLYPHS,
  'pull-request': PULL_REQUEST_GLYPHS,
};

describe('activityRowConcept', () => {
  it.each(KINDS)('draws the %s row with the glyph its concept owns', (kind) => {
    expect(CONCEPT_ICONS[activityRowConcept({ kind })]).toBe(EXPECTED[kind]);
  });

  it('gives a workflow run the Workflows glyph of the New menu, whatever its origin', () => {
    expect(RUN_KIND_GLYPH.preset.icon).toBe(CONCEPT_ICONS.workflows);
    expect(RUN_KIND_GLYPH.custom.icon).toBe(CONCEPT_ICONS.workflows);
    expect(RUN_KIND_GLYPH.orchestrator.icon).toBe(CONCEPT_ICONS.orchestrator);
  });

  it.each(EVENT_KINDS)('draws the %s event with a glyph from its registry', (kind) => {
    const registry = GLYPHS_BY_SOURCE[EVENT_GLYPH_SOURCE[kind]];
    expect(registry.has(sessionEventGlyph({ kind }).icon)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  WIREFRAME_SCOUT_DEMOTION_REASON,
  WIREFRAME_SCOUT_LIMITS,
  WIREFRAME_SCOUT_NOTHING_USABLE,
} from '../wireframes/wireframeScoutReports';
import { artifactScoutSection, REPORT_SCOUT_NOTHING_USABLE } from './artifactScoutSection';

const entry = ({
  name,
  header = null,
  body = null,
  note = null,
}: {
  readonly name: string;
  readonly header?: string | null;
  readonly body?: string | null;
  readonly note?: string | null;
}) => ({ name, header, body, note });

describe('artifactScoutSection for a wireframe', () => {
  it('names the root, states the hearsay rule and carries both reports', () => {
    const section = artifactScoutSection({
      kind: 'wireframe',
      scope: 'apps/web',
      entries: [
        entry({
          name: 'screens and routes',
          header: 'verified 2 of 2 cited paths',
          body: 'screens',
        }),
        entry({ name: 'data and contracts', body: 'contracts' }),
      ],
    });
    expect(section).toContain('rooted at apps/web');
    expect(section).toContain('hearsay');
    expect(section).toContain('### screens and routes');
    expect(section).toContain('### data and contracts');
    expect(section).not.toContain(WIREFRAME_SCOUT_NOTHING_USABLE);
  });

  it('says scouting produced nothing usable when no report survived', () => {
    const section = artifactScoutSection({
      kind: 'wireframe',
      scope: '.',
      entries: [
        entry({ name: 'screens and routes', note: 'this scout failed' }),
        entry({ name: 'data and contracts', note: WIREFRAME_SCOUT_DEMOTION_REASON }),
      ],
    });
    expect(section).toContain(WIREFRAME_SCOUT_NOTHING_USABLE);
    expect(section).toContain('this scout reported nothing usable: this scout failed');
  });

  it('never grows past the section budget', () => {
    const section = artifactScoutSection({
      kind: 'wireframe',
      scope: '.',
      entries: [
        entry({ name: 'screens and routes', body: 'x'.repeat(20_000) }),
        entry({ name: 'data and contracts', body: 'y'.repeat(20_000) }),
      ],
    });
    expect(section.length).toBeLessThanOrEqual(WIREFRAME_SCOUT_LIMITS.section);
  });
});

describe('artifactScoutSection for a report', () => {
  it('names the repositories and never says a wireframe is being drawn', () => {
    const section = artifactScoutSection({
      kind: 'report',
      scope: 'goodboy, goodboy-api',
      entries: [entry({ name: 'diff context', body: 'the totals helper moved a/b.ts' })],
    });
    expect(section).toContain('goodboy, goodboy-api');
    expect(section).not.toContain('wireframe');
    expect(section).not.toContain('rooted at');
  });

  it('tells a report with no usable scout that the report is written from the pack', () => {
    const section = artifactScoutSection({
      kind: 'report',
      scope: 'goodboy',
      entries: [entry({ name: 'diff context', note: 'this scout failed' })],
    });
    expect(section).toContain(REPORT_SCOUT_NOTHING_USABLE);
    expect(section).not.toContain(WIREFRAME_SCOUT_NOTHING_USABLE);
  });

  it('never hands a report the screen and theme hearsay rule', () => {
    const section = artifactScoutSection({
      kind: 'report',
      scope: 'goodboy',
      entries: [entry({ name: 'diff context', body: 'the totals helper moved a/b.ts' })],
    });
    expect(section).toContain('hearsay');
    expect(section).not.toContain('never a screen');
    expect(section).not.toContain('never a theme value');
  });
});

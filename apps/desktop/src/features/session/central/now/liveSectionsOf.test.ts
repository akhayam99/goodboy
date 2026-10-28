// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FIXTURE_NOW } from '../../../auto/testing/autoViewFixtures';
import { liveGroupsOf } from './liveGroupsOf';
import { liveSectionsOf } from './liveSectionsOf';
import { aNowAgent, nowModelOf } from './testing/nowModelOf';

type StatusParams = {
  readonly statuses: ReadonlyArray<readonly [string, 'running' | 'blocked' | 'failed']>;
};

const sectionsOf = ({ statuses }: StatusParams) => {
  const agents = statuses.map(([name, status]) => aNowAgent({ key: name, name, status }));
  const groups = liveGroupsOf({ model: nowModelOf({ agents }), agents, now: FIXTURE_NOW });
  return liveSectionsOf({ groups }).map((section) => [
    section.id,
    section.groups.map((group) => group.title),
  ]);
};

describe('liveSectionsOf', () => {
  it('groups by what you do next: Needs you, then Running, then Stopped', () => {
    expect(
      sectionsOf({
        statuses: [
          ['Rebuild the index', 'running'],
          ['Retry the import', 'failed'],
          ['Check the docs', 'blocked'],
        ],
      }),
    ).toEqual([
      ['needs-you', ['Check the docs']],
      ['running', ['Rebuild the index']],
      ['stopped', ['Retry the import']],
    ]);
  });

  it('never puts a waiting or a failed item under Running', () => {
    const sections = sectionsOf({
      statuses: [
        ['Check the docs', 'blocked'],
        ['Retry the import', 'failed'],
      ],
    });

    expect(sections.map(([id]) => id)).toEqual(['needs-you', 'stopped']);
  });

  it('leaves out a section with nothing in it', () => {
    expect(sectionsOf({ statuses: [['Rebuild the index', 'running']] })).toEqual([
      ['running', ['Rebuild the index']],
    ]);
  });

  it('draws nothing for no work', () => {
    expect(liveSectionsOf({ groups: [] })).toEqual([]);
  });

  it('keeps the order of the groups inside a section', () => {
    expect(
      sectionsOf({
        statuses: [
          ['Add the limit table', 'running'],
          ['Check the docs', 'running'],
        ],
      }),
    ).toEqual([['running', ['Add the limit table', 'Check the docs']]]);
  });
});

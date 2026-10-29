// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { FIXTURE_NOW } from '../../../auto/testing/autoViewFixtures';
import { liveGroupsOf } from './liveGroupsOf';
import { liveSectionsOf } from './liveSectionsOf';
import { aNowAgent, aNowRun, aNowStepAgent, aNowWorkflow, nowModelOf } from './testing/nowModelOf';

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

  it('names the waiting section differently from the Needs you card above the list', () => {
    const [section] = liveSectionsOf({
      groups: liveGroupsOf({
        model: nowModelOf({
          agents: [aNowAgent({ key: 'docs', name: 'Check the docs', status: 'blocked' })],
        }),
        agents: [aNowAgent({ key: 'docs', name: 'Check the docs', status: 'blocked' })],
        now: FIXTURE_NOW,
      }),
    });

    expect(section?.id).toBe('needs-you');
    expect(section?.title).toBe('Waiting for you');
    expect(section?.title).not.toBe('Needs you');
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

  it('puts a workflow with a stopped step under Stopped, like a stopped agent', () => {
    const attached = aNowRun({
      key: 'ship',
      title: 'Ship',
      workflow: aNowWorkflow({ key: 'ship', name: 'Ship', stepNames: ['Scope', 'Review'] }),
    });
    const agents = [aNowStepAgent({ attached, stepIndex: 0, status: 'stopped', name: 'Scope' })];
    const groups = liveGroupsOf({
      model: nowModelOf({ agents, runs: [attached] }),
      agents,
      now: FIXTURE_NOW,
    });

    expect(groups.map((group) => group.state)).toEqual(['waiting']);
    expect(liveSectionsOf({ groups }).map((section) => section.id)).toEqual(['stopped']);
  });

  it('sorts each section by start time, not by the state priority', () => {
    const attached = aNowRun({
      key: 'ship',
      title: 'Ship',
      workflow: aNowWorkflow({ key: 'ship', name: 'Ship', stepNames: ['Scope', 'Review'] }),
    });
    const earlier = {
      ...aNowAgent({ key: 'early', name: 'Rebuild the index', status: 'running' }),
      startedAt: brandId<IsoDateTime>({ value: '2026-10-13T11:00:00.000Z' }),
    };
    const step = aNowStepAgent({ attached, stepIndex: 0, status: 'running', name: 'Scope' });
    const agents = [earlier, step];
    const groups = liveGroupsOf({
      model: nowModelOf({
        agents,
        runs: [attached],
        decidingRunIds: new Set([attached.run.id]),
      }),
      agents,
      now: FIXTURE_NOW,
    });

    expect(groups.map((group) => group.state)).toEqual(['deciding', 'working']);
    expect(liveSectionsOf({ groups }).map((section) => section.groups.map((g) => g.title))).toEqual(
      [['Rebuild the index', 'Ship']],
    );
  });
});

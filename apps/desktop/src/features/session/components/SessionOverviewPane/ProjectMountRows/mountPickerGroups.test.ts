// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Project, ProjectId } from '@goodboy/types';
import { mountPickerGroups } from './mountPickerGroups';

const projectNamed = ({ name }: { readonly name: string }): Project =>
  JSON.parse(
    JSON.stringify({
      id: `project-${name}`,
      workspaceId: 'workspace-harborline',
      name,
      kind: 'repo',
      rootPath: `/repos/${name}`,
    }),
  );

const LEDGER = projectNamed({ name: 'ledger-core' });
const RELAY = projectNamed({ name: 'notify-relay' });
const PAYMENTS = projectNamed({ name: 'payments-api' });

const idOf = ({ project }: { readonly project: Project }): ProjectId => project.id;

describe('mountPickerGroups', () => {
  it('lists the folders an agent asked for first, then the workspace', () => {
    const groups = mountPickerGroups({
      filtered: [LEDGER, RELAY, PAYMENTS],
      total: 3,
      recentIds: [],
      requestedIds: [idOf({ project: PAYMENTS })],
      isQueryEmpty: true,
    });

    expect(groups.map((group) => [group.label, group.projects.map((p) => p.name)])).toEqual([
      ['Asked by an agent', ['payments-api']],
      ['In the workspace', ['ledger-core', 'notify-relay']],
    ]);
  });

  it('keeps one unlabelled list when no agent asked', () => {
    const groups = mountPickerGroups({
      filtered: [LEDGER, RELAY],
      total: 2,
      recentIds: [],
      requestedIds: [],
      isQueryEmpty: true,
    });

    expect(groups.map((group) => group.label)).toEqual([null]);
  });

  it('drops the asked group while a search is typed', () => {
    const groups = mountPickerGroups({
      filtered: [PAYMENTS],
      total: 3,
      recentIds: [],
      requestedIds: [idOf({ project: PAYMENTS })],
      isQueryEmpty: false,
    });

    expect(groups.map((group) => group.key)).toEqual(['all']);
  });
});

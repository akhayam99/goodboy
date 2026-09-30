// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { selectProjectById } from './selectProjectById';

const WS = 'workspace-harborline' as WorkspaceId;
const ledger = aProject({ id: 'project-ledger' as ProjectId, workspaceId: WS });
const notify = aProject({ id: 'project-notify' as ProjectId, workspaceId: WS });

describe('selectProjectById', () => {
  it('returns the project the list holds', () => {
    expect(selectProjectById({ projects: [ledger, notify] }, notify.id)).toBe(notify);
  });

  it('returns null for a missing or unknown id', () => {
    expect(selectProjectById({ projects: [ledger] }, null)).toBeNull();
    expect(selectProjectById({ projects: [ledger] }, 'project-unknown')).toBeNull();
  });
});

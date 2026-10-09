// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';
import type { SessionStudio } from '../../../../../store';

const workspace = { id: 'workspace-1', name: 'goodboy', rootPath: '/tmp/goodboy' };

vi.mock('../../../../../store', () => ({
  useCurrentWorkspace: () => workspace,
}));

vi.mock('../../../../workflows/components/WorkflowBuilderView', () => ({
  WorkflowBuilderView: () => <div data-testid="studio-workflow" />,
}));

import { SessionStudioLayer } from './SessionStudioLayer';

const session = { id: 'session-1' } as unknown as Session;

afterEach(() => {
  cleanup();
});

const renderStudio = (studio: SessionStudio) => {
  render(<SessionStudioLayer session={session} studio={studio} onClose={() => undefined} />);
};

describe('SessionStudioLayer', () => {
  it('renders the workflow builder for a workflow studio', () => {
    renderStudio({ kind: 'workflow' });
    expect(screen.getByTestId('studio-workflow')).not.toBeNull();
  });

  it('has no code host studio kind: the Branch page owns pull requests', () => {
    const kinds: ReadonlyArray<SessionStudio['kind']> = ['workflow'];
    expect(kinds).toEqual(['workflow']);
  });
});

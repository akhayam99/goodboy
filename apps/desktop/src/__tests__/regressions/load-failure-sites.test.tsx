// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { ChecksFailedNotice } from '../../features/branch/components/ChecksFailedNotice';
import { BodyNotice } from '../../features/diff/components/DiffView/BodyNotice';
import { ContextLoadFailure } from '../../features/session/components/ContextDrawer/ContextLoadFailure';
import { ImportGroupSection } from '../../features/workflows/components/WorkflowStudio/ImportPopover/ImportGroupSection';

afterEach(cleanup);

const STACK = 'git exited with status 128\nfatal: not a git repository';

describe('every failed load is one ErrorStrip', () => {
  it('draws checks that did not load with Retry and Details', () => {
    const onRetry = vi.fn();
    render(<ChecksFailedNotice isChecking={false} error={STACK} onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't load checks");
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(alert.textContent).toContain('fatal: not a git repository');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('draws a diff body that did not load with Retry', () => {
    const onRetry = vi.fn();
    render(<BodyNotice state="failed" path="src/ledger/export.ts" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain("Couldn't load this diff");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith({ path: 'src/ledger/export.ts' });
  });

  it('offers no Retry on a diff body that has no way to retry', () => {
    render(<BodyNotice state="failed" path="src/ledger/export.ts" onRetry={null} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('draws the context that did not load as a strip, not an empty state', () => {
    const onRetry = vi.fn();
    render(<ContextLoadFailure title="Context" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't load context");
    expect(alert.textContent).toContain('Nothing in the session was changed.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('draws the workflows of a workspace that did not load with Retry', () => {
    const onRetry = vi.fn();
    render(
      <ImportGroupSection
        group={{
          workspaceId: brandId<WorkspaceId>({ value: 'ws-2' }),
          workspaceName: 'Northwind',
          projectNames: ['ledger-core'],
          status: 'failed',
          workflows: [],
          error: 'Offline',
        }}
        workflows={[]}
        selected={new Set()}
        takenNames={new Set()}
        disabled={false}
        onToggle={vi.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load workflows from Northwind",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

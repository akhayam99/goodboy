// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PlanWithCount } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION, aPlan } from '../../../../test/planFixtures';
import { PlanEditor } from './index';
import { PlanEditorActions } from './PlanEditorActions';
import { usePlanEditor } from './usePlanEditor';

type SaveResult = { readonly kind: 'saved' | 'conflict'; readonly revision: number };

const PLAN: PlanWithCount = aPlan();

const SOURCE =
  '# Retry-safe webhook credits\n\n## Goal\nRetried webhooks must never post a second credit.';

type HarnessProps = {
  readonly plan?: PlanWithCount | null;
  readonly revision?: number;
  readonly onSaved?: (params: { readonly revision: number }) => void;
};

const Harness = ({ plan = PLAN, revision = 2, onSaved }: HarnessProps) => {
  const editor = usePlanEditor({ sessionId: PLAN_FIXTURE_SESSION, plan, revision, onSaved });
  return (
    <div>
      <button type="button" onClick={editor.start}>
        Start
      </button>
      {editor.isEditing ? <PlanEditorActions editor={editor} /> : null}
      <PlanEditor editor={editor} title="Retry-safe webhook credits" />
      <p data-testid="state">{editor.isEditing ? 'editing' : 'reading'}</p>
    </div>
  );
};

const stubSave = (result: SaveResult) => {
  const updatePlanBody = vi.fn(async () => result);
  useAppStore.setState({ updatePlanBody });
  return updatePlanBody;
};

const edit = (text: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

const escape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

const start = () => fireEvent.click(screen.getByRole('button', { name: 'Start' }));

beforeEach(() => {
  stubSave({ kind: 'saved', revision: 3 });
});

afterEach(cleanup);

describe('PlanEditor', () => {
  it('opens the plan as markdown with its title on the first line', () => {
    render(<Harness />);

    start();

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(SOURCE);
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe(
      'Edit Retry-safe webhook credits',
    );
  });

  it('does nothing for something that is not a plan', () => {
    render(<Harness plan={null} />);

    start();

    expect(screen.getByTestId('state').textContent).toBe('reading');
  });

  it('saves the new title and body against the revision it started from, then leaves edit mode', async () => {
    const updatePlanBody = stubSave({ kind: 'saved', revision: 5 });
    const onSaved = vi.fn();
    render(<Harness revision={4} onSaved={onSaved} />);
    start();

    edit('# Retry once\n\n## Goal\nOne credit per event.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('reading'));
    expect(updatePlanBody).toHaveBeenCalledWith(
      PLAN_FIXTURE_SESSION,
      PLAN_FIXTURE_ID,
      'Retry once',
      '## Goal\nOne credit per event.',
      4,
    );
    expect(onSaved).toHaveBeenCalledWith({ revision: 5 });
  });

  it('writes nothing when the text did not change', () => {
    const updatePlanBody = stubSave({ kind: 'saved', revision: 3 });
    render(<Harness />);
    start();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(updatePlanBody).not.toHaveBeenCalled();
    expect(screen.getByTestId('state').textContent).toBe('reading');
  });

  it('keeps your text and says the planner wrote meanwhile when the revision moved', async () => {
    const onSaved = vi.fn();
    stubSave({ kind: 'conflict', revision: 3 });
    render(<Harness onSaved={onSaved} />);
    start();

    edit('# Retry once\n\n## Goal\nMine.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The planner wrote v3 meanwhile')).toBeDefined();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      '# Retry once\n\n## Goal\nMine.',
    );
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByTestId('state').textContent).toBe('reading');
  });

  it('refuses a save without a title and writes nothing', async () => {
    const updatePlanBody = stubSave({ kind: 'saved', revision: 3 });
    render(<Harness />);
    start();

    edit('\n\n');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The first line is the plan title. Add one before saving.',
    );
    expect(updatePlanBody).not.toHaveBeenCalled();
  });

  it('shows a failed write inline and keeps the editor open', async () => {
    useAppStore.setState({
      updatePlanBody: vi.fn(async () => {
        throw new Error('The database is locked');
      }),
    });
    render(<Harness />);
    start();

    edit('# Retry once\n\n## Goal\nMine.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toContain('The database is locked');
    expect(screen.getByTestId('state').textContent).toBe('editing');
  });

  it('leaves on Escape when nothing changed', () => {
    render(<Harness />);
    start();

    escape();

    expect(screen.getByTestId('state').textContent).toBe('reading');
  });

  it('asks before it drops a changed edit, and Escape again keeps editing', () => {
    render(<Harness />);
    start();
    edit('# Retry once\n\n## Goal\nMine.');

    escape();
    expect(screen.getByRole('group', { name: 'Discard your edit?' })).toBeDefined();
    expect(screen.getByTestId('state').textContent).toBe('editing');

    escape();
    expect(screen.queryByRole('group', { name: 'Discard your edit?' })).toBeNull();
    expect(screen.getByTestId('state').textContent).toBe('editing');
  });

  it('drops the edit once Discard is confirmed, and keeps it on Keep editing', () => {
    render(<Harness />);
    start();
    edit('# Retry once\n\n## Goal\nMine.');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByTestId('state').textContent).toBe('editing');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByTestId('state').textContent).toBe('reading');
  });
});

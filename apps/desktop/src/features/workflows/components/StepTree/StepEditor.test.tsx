// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { StepDraft } from '../../engine';
import { usePolish } from '../../hooks/usePolish';
import { useStepDeleteUndo } from '../../hooks/useStepDeleteUndo';
import { StepEditor } from './StepEditor';

const draft = (key: string, name: string): StepDraft => ({
  key,
  sourceStepId: null,
  libraryStepId: null,
  role: 'scout',
  name,
  prompt: 'List the files in scope for the ledger-core retry',
  expectedOutput: 'a map of files',
  provider: '',
  model: '',
  effort: 'medium',
  verbosity: 'normal',
  size: null,
});

type HostProps = {
  readonly polished: string;
  readonly roleSetLine?: string | null;
  readonly onDone: () => void;
  readonly onPin: () => void;
  readonly onMoveDown: () => void;
};

const Host = ({ polished, roleSetLine = null, onDone, onPin, onMoveDown }: HostProps) => {
  const [steps, setSteps] = useState<ReadonlyArray<StepDraft>>([
    draft('scout', 'Map the ledger flow'),
    draft('plan', 'Plan the retries'),
  ]);
  const polish = usePolish({ onError: () => undefined });
  const deleteStep = useStepDeleteUndo({ steps, setSteps, contextKey: null });
  const patch = (key: string, next: Partial<StepDraft>) =>
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...next } : step)));
  const first = steps[0];
  return (
    <>
      <ol aria-label="Step names">
        {steps.map((step) => (
          <li key={step.key}>{step.name}</li>
        ))}
      </ol>
      {first === undefined ? null : (
        <StepEditor
          step={first}
          ordinal={1}
          stepCount={steps.length}
          effort="medium"
          recommendedProvider="anthropic"
          recommendedModel="claude-sonnet-4-6"
          connectedProviders={['anthropic']}
          isRoutingOverridden={false}
          roleSetLine={roleSetLine}
          disabled={false}
          polish={{
            prompt: {
              isPolishing: polish.polishingId === 'prompt',
              isBusy: polish.polishingId !== null,
              canUndo: polish.canUndo({ id: 'prompt', current: first.prompt }),
              onPolish: () =>
                void polish.run({
                  id: 'prompt',
                  current: first.prompt,
                  keptMessage: 'Kept your wording.',
                  polish: async () => polished,
                  apply: (prompt) => patch(first.key, { prompt }),
                }),
              onUndo: () =>
                polish.undo({
                  id: 'prompt',
                  current: first.prompt,
                  apply: (prompt) => patch(first.key, { prompt }),
                }),
            },
            expectedOutput: {
              isPolishing: false,
              isBusy: false,
              canUndo: false,
              onPolish: () => undefined,
              onUndo: () => undefined,
            },
          }}
          onName={(name) => patch(first.key, { name })}
          onRole={() => undefined}
          onPrompt={(prompt) => patch(first.key, { prompt })}
          onExpectedOutput={() => undefined}
          onRoute={(route) => patch(first.key, route)}
          onVerbosity={(verbosity) => patch(first.key, { verbosity })}
          onRoutingReset={() => undefined}
          onPin={onPin}
          onMoveUp={() => undefined}
          onMoveDown={onMoveDown}
          onDuplicate={() => undefined}
          onDelete={() => deleteStep(first.key)}
          onDone={onDone}
        />
      )}
    </>
  );
};

const callbacks = () => ({ onDone: vi.fn(), onPin: vi.fn(), onMoveDown: vi.fn() });

const renderHost = ({
  polished = 'Polished instruction.',
  ...handlers
}: Partial<HostProps> & ReturnType<typeof callbacks>) =>
  render(
    <ToastProvider>
      <Host polished={polished} {...handlers} />
    </ToastProvider>,
  );

const names = () =>
  within(screen.getByRole('list', { name: 'Step names' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const instruction = () => screen.getByRole('textbox', { name: 'Instruction' });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('StepEditor', () => {
  it('closes on Esc and on its one primary, Done', () => {
    const handlers = callbacks();
    renderHost(handlers);

    fireEvent.keyDown(instruction(), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(handlers.onDone).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move step up' })).toBeNull();
  });

  it('keeps the rare actions in the menu and runs the one you pick', () => {
    const handlers = callbacks();
    renderHost(handlers);

    fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
    expect(screen.getByRole('menuitem', { name: 'Move up' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move down' }));

    expect(handlers.onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('deletes the step at once and puts it back in place with Undo', async () => {
    renderHost(callbacks());

    fireEvent.click(screen.getByRole('button', { name: 'Step actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete step' }));
    expect(names()).toEqual(['Plan the retries']);

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(names()).toEqual(['Map the ledger flow', 'Plan the retries']);
  });

  it('follows the role until you pin a model', () => {
    const handlers = callbacks();
    renderHost(handlers);

    expect(screen.getByTestId('step-follows-role').textContent).toContain('Follows the Scout role');
    fireEvent.click(screen.getByRole('tab', { name: 'Pin a model' }));

    expect(handlers.onPin).toHaveBeenCalledTimes(1);
  });

  it('polishes the instruction and puts your wording back with Undo polish', async () => {
    renderHost(callbacks());

    fireEvent.click(screen.getByRole('button', { name: 'Polish instruction' }));
    await waitFor(() => expect(instruction()).toHaveProperty('value', 'Polished instruction.'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo polish of instruction' }));

    expect(instruction()).toHaveProperty(
      'value',
      'List the files in scope for the ledger-core retry',
    );
    screen.getByRole('button', { name: 'Polish instruction' });
  });

  it('calls it Reply length and saves the level you pick', () => {
    renderHost(callbacks());

    const group = screen.getByRole('tablist', { name: 'Reply length' });
    fireEvent.click(within(group).getByRole('tab', { name: 'Short' }));

    expect(within(group).getByRole('tab', { name: 'Short' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('says the step follows its role set while it follows its role', () => {
    renderHost({ ...callbacks(), roleSetLine: 'Planning models · Opus 5.5' });

    expect(screen.getByTestId('step-follows-role').textContent).toBe(
      'Follows the role: Planning models · Opus 5.5',
    );
  });
});

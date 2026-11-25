// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { brandId, type OpenQuestionId, type SessionId } from '@goodboy/types';
import { parseAskAnswer } from '../../parseAskAnswer';
import { AskAnswer } from './AskAnswer';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const SESSION = brandId<SessionId>({ value: 'session-webhooks' });

const FENCED = [
  '**Two failures count as a retry.**',
  '```ts',
  'const isRetry = attempts > 1;',
  '```',
  '- one',
  '',
  '| Check | State |',
  '| --- | --- |',
  '| notify-relay | running |',
  '| payments-api | failed |',
  'Done.',
].join('\n');

type ShowParams = {
  readonly text: string;
};

const show = ({ text }: ShowParams) => {
  const parsed = parseAskAnswer({ text, handles: [] });
  return render(
    <AskAnswer sessionId={SESSION} blocks={parsed.blocks} isStreaming={false} onOpen={() => {}} />,
  );
};

afterEach(cleanup);

describe('the Ask answer', () => {
  it('parses a fence and a table as markdown blocks between the prose', () => {
    const parsed = parseAskAnswer({ text: FENCED, handles: [] });
    expect(parsed.blocks.map((block) => block.kind)).toEqual([
      'paragraph',
      'markdown',
      'item',
      'markdown',
      'paragraph',
    ]);
  });

  it('draws a fenced block as code with its language and a Copy button', () => {
    const view = show({ text: FENCED });
    const code = view.container.querySelector('[data-block="code"]');
    expect(code?.textContent).toContain('const isRetry = attempts > 1;');
    expect(code?.textContent).toContain('ts');
    expect(view.container.textContent).not.toContain('```');
    screen.getByRole('button', { name: /Copy/ });
  });

  it('draws a markdown table as a real table', () => {
    const view = show({ text: FENCED });
    const cells = [...view.container.querySelectorAll('table td, table th')].map(
      (cell) => cell.textContent,
    );
    expect(cells).toEqual(['Check', 'State', 'notify-relay', 'running', 'payments-api', 'failed']);
    expect(view.container.textContent).not.toContain('| ---');
  });

  it('keeps a bracket pair inside a fence and names a handle cited in a table cell', () => {
    const parsed = parseAskAnswer({
      text: ['```ts', 'const prefix = "[[";', '```', '| Q |', '| --- |', '| [[Q1]] |'].join('\n'),
      handles: [
        {
          key: 'Q1',
          label: 'Question 1',
          target: { kind: 'question', questionId: 'q-1' as OpenQuestionId },
        },
      ],
    });
    expect(parsed.blocks.map((block) => block.kind)).toEqual(['markdown', 'markdown']);
    expect(parsed.blocks[0]).toMatchObject({ text: expect.stringContaining('"[["') });
    expect(parsed.blocks[1]).toMatchObject({ text: expect.stringContaining('Question 1') });
    expect(parsed.cited).toHaveLength(1);
  });

  it('keeps a fence that is still streaming as code', () => {
    const view = show({ text: 'Here:\n```sh\npnpm test' });
    expect(view.container.querySelector('[data-block="code"]')?.textContent).toContain('pnpm test');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecordSections } from './index';
import type { RecordSection, RecordSectionKind } from './types';

afterEach(cleanup);

type SectionParams = {
  readonly key: string;
  readonly kind: RecordSectionKind;
  readonly isCollapsible?: boolean;
  readonly defaultOpen?: boolean;
};

const section = ({
  key,
  kind,
  isCollapsible = kind === 'tool',
  defaultOpen = kind !== 'tool',
}: SectionParams): RecordSection => ({
  key,
  kind,
  label: key,
  isCollapsible,
  defaultOpen,
  content: <p>{`${key} body`}</p>,
});

const DESCRIPTION = section({ key: 'Description', kind: 'description' });
const CONVERSATION = section({ key: 'Conversation', kind: 'conversation' });

const renderedOrder = () =>
  [...document.querySelectorAll('[data-record-section]')].map((node) =>
    node.getAttribute('data-record-section'),
  );

describe('RecordSections', () => {
  it.each([
    ['linear', []],
    ['jira', []],
    ['github', []],
    ['gitlab issue', []],
    ['slack', []],
    ['gitlab merge request', ['Approvals']],
    ['bitbucket pull request', ['Checks', 'Changes']],
    ['sentry', ['Stack trace', 'Breadcrumbs']],
  ] as const)('keeps one order for %s: description, tool sections, conversation', (_, tools) => {
    const toolSections = tools.map((key) => section({ key, kind: 'tool' }));
    render(<RecordSections sections={[CONVERSATION, ...toolSections, DESCRIPTION]} />);

    expect(renderedOrder()).toEqual(['Description', ...tools, 'Conversation']);
  });

  it('keeps a tool section closed behind its summary until it is opened', () => {
    render(
      <RecordSections
        sections={[{ ...section({ key: 'Changes', kind: 'tool' }), summary: '12 files +340 −88' }]}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Changes/ });
    expect(trigger.textContent).toContain('12 files +340 −88');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Changes body')).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByText('Changes body')).toBeDefined();
  });

  it('opens a tool section by default when it is the description of the record', () => {
    render(
      <RecordSections
        sections={[section({ key: 'Stack trace', kind: 'tool', defaultOpen: true })]}
      />,
    );

    expect(screen.getByText('Stack trace body')).toBeDefined();
  });

  it('counts the conversation next to its label', () => {
    render(<RecordSections sections={[{ ...CONVERSATION, count: 6 }]} />);

    expect(screen.getByRole('region', { name: 'Conversation' }).textContent).toContain('6');
  });
});

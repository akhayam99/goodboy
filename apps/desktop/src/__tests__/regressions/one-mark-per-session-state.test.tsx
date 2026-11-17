// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StatusMark } from '@goodboy/ui';
import type { SessionAttentionReason } from '@goodboy/types';
import { ATTENTION_REASON_META } from '../../features/session/session-stage';
import { attentionMarkOf } from '../../features/session/attentionMarkOf';
import { sessionMarkOf } from '../../features/session/sessionMarkOf';
import { sessionNodeOf } from '../../features/session/sessionNode';

const SRC = join(__dirname, '..', '..');

const REASONS: ReadonlyArray<SessionAttentionReason> = Object.keys(ATTENTION_REASON_META).filter(
  (key): key is SessionAttentionReason => Object.hasOwn(ATTENTION_REASON_META, key),
);

const ROW = 'features/workspace/components/SessionActivityBar/SessionActivityItem.tsx';

const HOVER_CARD = 'features/workspace/components/SessionHoverCard/SessionHoverCardBody.tsx';

const SESSION_STATE_SURFACES: ReadonlyArray<string> = [
  ROW,
  HOVER_CARD,
  'features/workspace/components/SessionSwitcher/SwitcherRow.tsx',
  'features/workspace/components/StageBoard/SignalBody.tsx',
  'app/components/SideColumn/RailSessionButton.tsx',
  'app/components/SideColumn/RailPinnedRow.tsx',
  'app/components/AppTopBar/NowChip/NeedsYouSessionRow.tsx',
  'features/palette/sources/needsYouEntries.ts',
  'features/settings/components/GuideStudio/parts/LegendSessionMarks.tsx',
];

const SECOND_PATHS: ReadonlyArray<RegExp> = [
  /\bStateNode\b/,
  /\bWorkNode\b/,
  /CONCEPT_ICONS\[\s*meta/,
  /\.icon\s*\?\?\s*'sessions'/,
];

type DrawParams = {
  readonly reason: SessionAttentionReason;
};

const rowMarkOf = ({ reason }: DrawParams) =>
  sessionMarkOf({
    node: sessionNodeOf({ info: { stage: 'attention', attention: reason }, isArchived: false }),
  });

const drawn = ({ mark }: { readonly mark: ReturnType<typeof attentionMarkOf> }) => {
  const { container } = render(<StatusMark mark={mark} />);
  const box = container.querySelector('[data-status-mark]');
  return {
    kind: box?.getAttribute('data-status-mark') ?? null,
    state: box?.getAttribute('data-status-state') ?? null,
    tone: box?.getAttribute('data-status-tone') ?? null,
    svg: box?.querySelector('svg')?.outerHTML ?? null,
  };
};

afterEach(() => {
  cleanup();
});

describe('one mark per session state', () => {
  it('reads the row and the hover card mark from the same row facts', () => {
    const readsMark = /const \{[^}]*\bmark\b[^}]*\} = useSessionRowFacts\(/;
    expect(readFileSync(join(SRC, ROW), 'utf8')).toMatch(readsMark);
    expect(readFileSync(join(SRC, HOVER_CARD), 'utf8')).toMatch(readsMark);
  });

  it.each(REASONS)('draws %s with the same glyph on the row and everywhere else', (reason) => {
    const row = drawn({ mark: rowMarkOf({ reason }) });
    cleanup();
    const elsewhere = drawn({ mark: attentionMarkOf({ reason }) });
    expect(row).toEqual(elsewhere);
    expect(row.kind).not.toBe('empty');
  });

  it('draws the Lead that needs you as the approval hand, like a permission', () => {
    expect(attentionMarkOf({ reason: 'auto-needs-you' })).toEqual(
      attentionMarkOf({ reason: 'needs-approval' }),
    );
    expect(ATTENTION_REASON_META['auto-needs-you'].words).toBe('Lead needs you');
  });

  it.each(SESSION_STATE_SURFACES)('%s draws no second glyph path', (path) => {
    const text = readFileSync(join(SRC, path), 'utf8');
    const found = SECOND_PATHS.filter((pattern) => pattern.test(text)).map(String);
    expect(found).toEqual([]);
  });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { REPORT_KIT_GUIDE } from '@goodboy/core';
import { Markdown } from '@goodboy/ui';
import { AGENT_KIND_DEFAULTS } from '../session/agent-kind';

afterEach(cleanup);

const BLOCK_MARKERS: ReadonlyArray<readonly [string, string]> = [
  ['<<facts>>\nTicket: ACME-1\n<</facts>>', '[data-block="facts"]'],
  ['<<metrics>>\nChecks: 3 of 4 | one blocked\n<</metrics>>', '[data-block="metrics"]'],
  ['<<timeline>>\n10:32 | deploy\n<</timeline>>', '[data-block="timeline"]'],
  ['one\n\n<<pagebreak>>\n\ntwo', '[data-block="pagebreak"]'],
  ['<<summary>>\nshipped\n<</summary>>', '[data-tone="summary"]'],
  ['<<decision>>\nrenew\n<</decision>>', '[data-tone="decision"]'],
  ['<<risk>>\nstale key\n<</risk>>', '[data-tone="risk"]'],
  ['<<question>>\nwho owns it\n<</question>>', '[data-tone="question"]'],
  ['<<note>>\ntruncated\n<</note>>', '[data-tone="note"]'],
  ['state <<ok>>', '[data-color="success"]'],
  ['state <<warn>>', '[data-color="warning"]'],
  ['state <<fail: 2 down>>', '[data-color="danger"]'],
  ['state <<todo>>', '[data-color="muted"]'],
  ['- [~] half done', '[data-task="partial"]'],
];

describe('report kit guide', () => {
  it('rides along in the report agent prompt', () => {
    expect(AGENT_KIND_DEFAULTS.report.systemPrompt).toContain(REPORT_KIT_GUIDE);
  });

  it('puts the user request ahead of the default shape', () => {
    expect(REPORT_KIT_GUIDE).toContain("the user's request comes first");
    expect(REPORT_KIT_GUIDE).toContain('language of the request');
  });

  it.each(BLOCK_MARKERS)(
    'teaches only blocks the renderer really draws: %s',
    (source, selector) => {
      const marker = source.match(/<<[a-z]+|- \[~\]/)?.[0] ?? source;
      expect(REPORT_KIT_GUIDE).toContain(marker);
      const { container } = render(<Markdown text={source} />);
      expect(container.querySelector(selector)).not.toBeNull();
    },
  );
});

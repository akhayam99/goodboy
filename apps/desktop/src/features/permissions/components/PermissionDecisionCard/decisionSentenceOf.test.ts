// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PermissionScope } from '@goodboy/types';
import { decisionSentenceOf } from './decisionSentenceOf';

type Row = readonly [
  decision: 'allow' | 'deny',
  scope: PermissionScope | undefined,
  sentence: string,
];

const ROWS: ReadonlyArray<Row> = [
  ['allow', 'once', 'Allowed pnpm test for this call'],
  ['deny', 'once', 'Denied pnpm test for this call'],
  ['deny', 'deny', 'Denied Bash for the rest of this session'],
  ['allow', 'session', 'Allowed Bash in this session'],
  ['allow', 'workspace', 'Allowed Bash in this workspace'],
  ['allow', 'project', 'Allowed Bash in this project'],
  ['allow', 'global', 'Allowed Bash in every workspace'],
  ['allow', undefined, 'Allowed pnpm test'],
  ['deny', undefined, 'Denied pnpm test'],
];

describe('decisionSentenceOf', () => {
  it.each(ROWS)('words %s with scope %s as "%s"', (decision, scope, sentence) => {
    expect(decisionSentenceOf({ decision, scope, toolName: 'Bash', subject: 'pnpm test' })).toBe(
      sentence,
    );
  });
});

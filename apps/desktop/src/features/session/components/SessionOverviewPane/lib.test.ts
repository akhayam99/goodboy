// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { OpenQuestion } from '@goodboy/types';
import { selectOpenQuestions } from './lib';

const question = (over: Partial<OpenQuestion>): OpenQuestion =>
  ({ status: 'open', text: 'q', ...over }) as unknown as OpenQuestion;

describe('selectOpenQuestions', () => {
  it('keeps only open questions', () => {
    const list = [
      question({ status: 'open' }),
      question({ status: 'answered' as OpenQuestion['status'] }),
      question({ status: 'open' }),
    ];
    expect(selectOpenQuestions(list)).toHaveLength(2);
  });
});

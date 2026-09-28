import { describe, expect, it } from 'vitest';
import { questionParts } from '.';

describe('questionParts', () => {
  it('reads a one line question as a title with no context', () => {
    expect(questionParts({ text: '  Which queue should retries run on?  ' })).toEqual({
      title: 'Which queue should retries run on?',
      context: '',
      files: [],
    });
  });

  it('takes the first line as the title and the rest as context', () => {
    const parts = questionParts({
      text: '## Keep the old path?\n\nA flag lets Cascadia roll back.\nIt costs two code paths.',
    });
    expect(parts.title).toBe('Keep the old path?');
    expect(parts.context).toBe('A flag lets Cascadia roll back.\nIt costs two code paths.');
  });

  it('lists the file paths quoted as code, once each', () => {
    const parts = questionParts({
      text: 'Where do retries go?\nSee `src/webhooks/dispatch.ts`, `src/jobs/queue.ts` and `src/webhooks/dispatch.ts`.',
    });
    expect(parts.files).toEqual(['src/webhooks/dispatch.ts', 'src/jobs/queue.ts']);
  });

  it('leaves code that is not a path out of the files', () => {
    const parts = questionParts({ text: 'Retry `payment.succeeded` into `webhook_dead_letters`?' });
    expect(parts.files).toEqual([]);
  });
});

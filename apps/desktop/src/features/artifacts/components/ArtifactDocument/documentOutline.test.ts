import { describe, expect, it } from 'vitest';
import { documentOutline } from './documentOutline';

describe('documentOutline', () => {
  it('lists the level two sections in document order', () => {
    expect(
      documentOutline({ sourceText: '# Title\n\n## What shipped\n\ntext\n\n## Risk\n\ntext' }),
    ).toEqual(['What shipped', 'Risk']);
  });

  it('strips inline markup so a label matches the heading it points at', () => {
    expect(
      documentOutline({
        sourceText: [
          '## **Checks**',
          '',
          '## [Risk](https://example.com/risk)',
          '',
          '## `deploy` notes',
          '',
          '## _slow_ ~~fast~~ rollout',
        ].join('\n'),
      }),
    ).toEqual(['Checks', 'Risk', 'deploy notes', 'slow fast rollout']);
  });

  it('drops a heading that is only markup', () => {
    expect(documentOutline({ sourceText: '## ****\n\ntext' })).toEqual([]);
  });
});

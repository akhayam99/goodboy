import { describe, expect, it } from 'vitest';
import { splitLead } from './splitLead';

describe('splitLead', () => {
  it('lifts everything before the first heading into the lead', () => {
    expect(
      splitLead({ sourceText: '<<summary>>\nshipped\n<</summary>>\n\n## Details\nbody' }),
    ).toEqual({ lead: '<<summary>>\nshipped\n<</summary>>', rest: '## Details\nbody' });
  });

  it('keeps a document that opens on a heading whole', () => {
    expect(splitLead({ sourceText: '## One\nbody' })).toEqual({ lead: '', rest: '## One\nbody' });
  });

  it('leaves a document with no heading in the body, so contents and lead never split it', () => {
    expect(splitLead({ sourceText: 'just prose' })).toEqual({ lead: '', rest: 'just prose' });
  });

  it('ignores a hash line inside a code fence', () => {
    const sourceText = 'intro\n```\n# not a heading\n```\n## Real\nbody';
    expect(splitLead({ sourceText }).lead).toBe('intro\n```\n# not a heading\n```');
  });
});

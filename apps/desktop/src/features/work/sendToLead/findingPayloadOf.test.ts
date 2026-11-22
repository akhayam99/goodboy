import { describe, expect, it } from 'vitest';
import { findingPayloadOf } from './findingPayloadOf';

describe('findingPayloadOf', () => {
  it('carries the id, the source, the text, the link and the project', () => {
    const text = findingPayloadOf({
      finding: {
        id: 'finding-12',
        source: 'Impact',
        text: 'Retry errors doubled since Tuesday.',
        link: 'https://example.test/impact/12',
        projectId: 'project-notify-relay',
      },
      projectName: 'notify-relay',
      note: '',
    });

    expect(text).toContain('A finding from Impact on notify-relay');
    expect(text).toContain('(finding-12)');
    expect(text).toContain('> Retry errors doubled since Tuesday.');
    expect(text).toContain('Its page: https://example.test/impact/12');
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildWireframeChangeRequest } from './buildWireframeChangeRequest';

describe('buildWireframeChangeRequest', () => {
  it('hands the agent the spec, the request, the picked ids and the scope', () => {
    const prompt = buildWireframeChangeRequest({
      title: 'Settlement review flow',
      revision: 3,
      ask: 'Show who owns each exception  ',
      scope: 'screen',
      screen: { id: 'review-batch', title: 'Review batch' },
      picked: [{ nodeId: 'exception-list', label: 'Exception list' }],
      sourceText: '{"version":2}',
    });
    expect(prompt).toContain('now at v3, into v4');
    expect(prompt).toContain('the request: Show who owns each exception\n');
    expect(prompt).toContain('only the screen "Review batch" (id review-batch)');
    expect(prompt).toContain('Exception list (id exception-list)');
    expect(prompt).toContain('keep the id of every node you did not change');
    expect(prompt).toContain('"version": 2');
  });

  it('opens the whole document when the scope is every screen', () => {
    const prompt = buildWireframeChangeRequest({
      title: 'Flow',
      revision: 1,
      ask: 'Add an error state',
      scope: 'all',
      screen: { id: 'a', title: 'A' },
      picked: [],
      sourceText: 'not json',
    });
    expect(prompt).toContain('scope: any screen of the wireframe.');
    expect(prompt).toContain('picked nodes: none.');
    expect(prompt).toContain('not json');
  });
});

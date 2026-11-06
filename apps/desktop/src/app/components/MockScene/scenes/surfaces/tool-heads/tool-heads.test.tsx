import { describe, expect, it } from 'vitest';
import { MOCK_SCENES } from '../../..';
import { U36_TOOL_HEADS_SCENES } from './tool-heads';

describe('the tool head scenes', () => {
  it('registers every scene for the capture, each one a real component', () => {
    const ids = Object.keys(U36_TOOL_HEADS_SCENES).sort();

    expect(ids).toEqual([
      'u36-p18-ask-answer',
      'u36-p18-explore-changed',
      'u36-p18-explore-empty',
      'u36-p18-explore-head',
      'u36-p18-scripts-suggested',
      'u36-p18-terminal-head',
      'u36-p18-tools-column',
    ]);
    for (const id of ids) {
      expect(MOCK_SCENES[id]).toBeDefined();
    }
  });
});

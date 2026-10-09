// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_CHOICE_LINE,
  pickLabel,
  reviewPullRequestLabel,
  startFromLabel,
} from './startCopy';

describe('startCopy', () => {
  it('says Start from the identifier, the same way for an issue and a pull request', () => {
    expect(startFromLabel({ identifier: 'HBL-412' })).toBe('Start from HBL-412');
    expect(startFromLabel({ identifier: '#318' })).toBe('Start from #318');
    expect(startFromLabel({ identifier: '!42' })).toBe('Start from !42');
  });

  it('picks an issue before starting it, and reviews a pull request by its number', () => {
    expect(pickLabel({ identifier: 'HBL-412' })).toBe('Pick HBL-412');
    expect(reviewPullRequestLabel({ identifier: '#318' })).toBe('Review pull request #318');
  });

  it('names the three ways to run a workflow with the builder switch words', () => {
    expect(WORKFLOW_CHOICE_LINE).toBe('Orchestrated, steps you describe, or a saved workflow.');
  });
});

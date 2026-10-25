import { describe, expect, it } from 'vitest';
import { sampleScoutReply } from '../../scenes/onboarding/sampleScoutReply';
import { DEMO_REPLIES } from './demoReplies';

const META = /\b(demo|playground|in the app|the app|sample response|no agent is connected)\b/i;

describe('simulated agent replies', () => {
  it('speak as the agent working on the sample project, never about the demo', () => {
    for (const reply of Object.values(DEMO_REPLIES)) {
      expect(reply).not.toMatch(META);
    }
  });

  it('keeps the fallback reply of the first task in the agent voice', () => {
    const reply = sampleScoutReply({ focus: 'anything else', folder: 'payments-api' });
    expect(reply).not.toMatch(META);
    expect(reply).toContain('payments-api');
  });
});

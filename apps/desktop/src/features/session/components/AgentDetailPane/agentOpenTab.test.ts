// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { agentOpenTab } from './agentOpenTab';

describe('agentOpenTab', () => {
  it('opens on the brief when it has content and nothing asked for a tab', () => {
    expect(agentOpenTab({ requested: null, remembered: null, hasBrief: true })).toBe('brief');
  });

  it('opens on the transcript when the brief has nothing to show yet', () => {
    expect(agentOpenTab({ requested: null, remembered: null, hasBrief: false })).toBe('transcript');
  });

  it('opens on the tab the user picked by hand on this agent', () => {
    expect(agentOpenTab({ requested: null, remembered: 'transcript', hasBrief: true })).toBe(
      'transcript',
    );
    expect(agentOpenTab({ requested: null, remembered: 'brief', hasBrief: false })).toBe('brief');
  });

  it('lets a door that targets a tab win over what the user picked before', () => {
    expect(agentOpenTab({ requested: 'transcript', remembered: 'brief', hasBrief: false })).toBe(
      'transcript',
    );
    expect(agentOpenTab({ requested: 'brief', remembered: 'transcript', hasBrief: true })).toBe(
      'brief',
    );
  });
});

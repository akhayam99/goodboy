import { describe, expect, it } from 'vitest';
import { CircleAlert } from 'lucide-react';
import { artifactStateCardOf } from './artifactStateCardOf';
import type { ArtifactState } from './artifactStateOf';

const STATE: ArtifactState = {
  key: 'needs',
  label: 'Needs you',
  reason: 'An agent asked a question, or the plan waits for your answer',
  tone: 'warning',
  icon: CircleAlert,
  group: 'needs',
  detail: '2 open questions',
};

describe('artifactStateCardOf', () => {
  it('shows the label, the detail with its tone and the reason as the footnote', () => {
    const card = artifactStateCardOf({ state: STATE });

    expect(card.title).toBe('Needs you');
    expect(card.state).toEqual({ tone: 'warning', words: '2 open questions' });
    expect(card.footnote).toBe(STATE.reason);
    expect(card.facts).toEqual([]);
  });

  it('leaves out the state line and the footnote when there is nothing to say', () => {
    const card = artifactStateCardOf({ state: { ...STATE, reason: '', detail: null } });

    expect(card.state).toBeUndefined();
    expect(card.footnote).toBeUndefined();
  });

  it('maps the success tone to ok and the brand tones to neutral', () => {
    expect(artifactStateCardOf({ state: { ...STATE, tone: 'success' } }).state?.tone).toBe('ok');
    expect(artifactStateCardOf({ state: { ...STATE, tone: 'merged' } }).state?.tone).toBe(
      'neutral',
    );
  });
});

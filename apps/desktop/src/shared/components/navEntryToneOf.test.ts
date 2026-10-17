import { describe, expect, it } from 'vitest';
import { SquareKanban } from 'lucide-react';
import { CONCEPT_ICONS } from './conceptIcons';
import { navEntryToneOf } from './navEntryToneOf';

describe('navEntryToneOf', () => {
  it.each([
    ['questions', CONCEPT_ICONS.questions, 'warning'],
    ['artifacts', CONCEPT_ICONS.plans, 'merged'],
    ['artifacts', CONCEPT_ICONS.artifacts, 'merged'],
    ['agents', CONCEPT_ICONS.agents, 'info'],
    ['auto agents', CONCEPT_ICONS.auto, 'info'],
    ['tasks', CONCEPT_ICONS.inbox, 'info'],
    ['files', CONCEPT_ICONS.diff, 'info'],
    ['checks', CONCEPT_ICONS.checks, 'success'],
  ])('lights %s with its concept tone', (_name, icon, tone) => {
    expect(navEntryToneOf({ icon })).toBe(tone);
  });

  it.each([
    ['overview', CONCEPT_ICONS.timeline],
    ['terminal', CONCEPT_ICONS.terminal],
    ['settings', CONCEPT_ICONS.settings],
    ['sessions', SquareKanban],
  ])('falls back to the primary accent for %s, which has no kind color', (_name, icon) => {
    expect(navEntryToneOf({ icon })).toBe('primary');
  });
});

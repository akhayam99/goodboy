import { describe, expect, it } from 'vitest';
import type { AgentId } from '@goodboy/types';
import {
  buildGoalKickoffSection,
  composeKickoff,
  composePlanSection,
  composeStepBoundary,
} from './kickoff';

describe('buildGoalKickoffSection', () => {
  it('wraps a goal in a labelled line', () => {
    expect(buildGoalKickoffSection('Ship gitlab.')).toBe('**Goal** Ship gitlab.');
  });

  it('returns an empty string for a missing or blank goal', () => {
    expect(buildGoalKickoffSection(undefined)).toBe('');
    expect(buildGoalKickoffSection('   ')).toBe('');
  });
});

describe('composeKickoff', () => {
  it('joins non-empty sections with a blank line', () => {
    expect(composeKickoff('goal', '', 'do it')).toBe('goal\n\ndo it');
  });

  it('returns an empty string when every section is empty', () => {
    expect(composeKickoff('', '')).toBe('');
  });
});

describe('composePlanSection', () => {
  it('labels the plan body on a single line header', () => {
    expect(composePlanSection({ bodyMd: '1. do it' })).toBe('**Plan**\n1. do it');
  });
});

describe('composeStepBoundary', () => {
  it('states the scope and the done marker in one line', () => {
    const text = composeStepBoundary('agent-1' as AgentId);
    expect(text).toContain('**Scope** this step only');
    expect(text).toContain('<<step-done id="agent-1">>');
    expect(text.split('\n')).toHaveLength(1);
  });
});

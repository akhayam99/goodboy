import { describe, expect, it } from 'vitest';
import { nextSessionId } from '@goodboy/types/testing';
import type { BrowserTab } from '../../store/slices/browser/types';
import { stepTab } from './stepTab';

const SESSION_ID = nextSessionId();

const tabOf = ({ id }: { readonly id: string }): BrowserTab => ({
  id,
  sessionId: SESSION_ID,
  projectId: null,
  url: `https://acme.example/${id}`,
  title: id,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const tabs = [tabOf({ id: 'a' }), tabOf({ id: 'b' })];
const pins = [tabOf({ id: 'pin' })];

describe('stepTab', () => {
  it('walks the list order with pins last and wraps at both ends', () => {
    expect(stepTab({ pins, tabs, currentId: 'a', step: 1 })?.id).toBe('b');
    expect(stepTab({ pins, tabs, currentId: 'b', step: 1 })?.id).toBe('pin');
    expect(stepTab({ pins, tabs, currentId: 'pin', step: 1 })?.id).toBe('a');
    expect(stepTab({ pins, tabs, currentId: 'a', step: -1 })?.id).toBe('pin');
  });

  it('starts at an end when nothing is shown', () => {
    expect(stepTab({ pins, tabs, currentId: null, step: 1 })?.id).toBe('a');
    expect(stepTab({ pins, tabs, currentId: null, step: -1 })?.id).toBe('pin');
  });

  it('returns nothing when there is no tab', () => {
    expect(stepTab({ pins: [], tabs: [], currentId: null, step: 1 })).toBeNull();
  });
});

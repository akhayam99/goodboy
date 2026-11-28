import { describe, expect, it } from 'vitest';
import { calendarRoleOptionsOf } from './calendarRoleOptionsOf';

type Params = Parameters<typeof calendarRoleOptionsOf>[0];

const labelsOf = ({ title, role }: Params) =>
  calendarRoleOptionsOf({ title, role }).map((option) => option.label);

describe('calendarRoleOptionsOf', () => {
  it('offers show, busy only and hide to a plain calendar', () => {
    expect(labelsOf({ title: 'Work', role: 'show' })).toEqual(['Show', 'Busy only', 'Hide']);
  });

  it('adds focus for a calendar named focus or already set to focus', () => {
    expect(labelsOf({ title: 'Deep Focus', role: 'show' })).toEqual([
      'Show',
      'Busy only',
      'Focus',
      'Hide',
    ]);
    expect(labelsOf({ title: 'Northwind blocks', role: 'focus' })).toContain('Focus');
  });
});

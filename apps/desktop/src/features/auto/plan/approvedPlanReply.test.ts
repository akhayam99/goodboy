// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { approvedPlanLabelOf, approvedPlanTextOf } from './approvedPlanReply';

describe('approvedPlanReply', () => {
  it('reads back the text Auto is told on approval', () => {
    expect(approvedPlanLabelOf({ text: approvedPlanTextOf({ revision: 2 }) })).toBe(
      'Approved plan v2',
    );
  });

  it('accepts the text with no final dot and with surrounding space', () => {
    expect(approvedPlanLabelOf({ text: ' Approved plan v1 ' })).toBe('Approved plan v1');
  });

  it('leaves a free message alone, even one that mentions the plan', () => {
    expect(approvedPlanLabelOf({ text: 'Approved plan v1, but also add a test' })).toBeNull();
    expect(approvedPlanLabelOf({ text: 'Please change the plan' })).toBeNull();
    expect(approvedPlanLabelOf({ text: '' })).toBeNull();
  });
});

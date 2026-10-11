import { WORK_META_COLUMN } from '@goodboy/ui';
import { describe, expect, it } from 'vitest';
import { ROW_ACTION_LABEL } from './rowActionLabels';

const ROW_ACTION_MAX_LENGTH = 9;

describe('row action labels', () => {
  it('fit the action slot in nine characters', () => {
    for (const label of Object.values(ROW_ACTION_LABEL)) {
      expect(label.length).toBeLessThanOrEqual(ROW_ACTION_MAX_LENGTH);
    }
  });

  it('keep the verbs the row actions share one spelling for', () => {
    expect(ROW_ACTION_LABEL).toMatchObject({
      answer: 'Answer',
      skip: 'Skip',
      openPlan: 'Open plan',
      open: 'Open',
      start: 'Start',
      resume: 'Resume',
      retry: 'Retry',
    });
  });

  it('sit in a fixed width action column', () => {
    expect(WORK_META_COLUMN.action).toContain('w-20');
    expect(WORK_META_COLUMN.action).not.toContain('min-w');
  });
});

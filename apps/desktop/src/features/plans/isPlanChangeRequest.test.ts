// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isPlanChangeRequest } from './isPlanChangeRequest';

describe('isPlanChangeRequest', () => {
  it.each([
    'Add a rollback step before the migration',
    'Replace step 3 with a dry run against Northwind',
    'please split the backfill into two batches',
    'Can you drop the tester step?',
    'Update the plan so it keeps the Harborline export untouched',
    'Make it shorter',
  ])('reads %j as a request to change the plan', (content) => {
    expect(isPlanChangeRequest({ content })).toBe(true);
  });

  it.each([
    'Why is the rollback step first?',
    'What does step 3 do?',
    'Explain the risk in the second section',
    'Can you explain step 2?',
    'Thanks, looks good',
    '',
    'Add',
  ])('does not read %j as a request to change the plan', (content) => {
    expect(isPlanChangeRequest({ content })).toBe(false);
  });
});

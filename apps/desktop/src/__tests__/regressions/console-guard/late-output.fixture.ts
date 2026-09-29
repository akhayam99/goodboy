import { afterAll, expect, it } from 'vitest';

afterAll(() => {
  console.error('late fixture output');
});

it('passes on its own', () => {
  expect(1).toBe(1);
});

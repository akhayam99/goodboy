import { expect } from 'vitest';
import { runA11yCheck } from './utils';

export const A11Y_BASELINE = {
  'NotificationCenter empty': [],
  'NotificationCenter populated': [],
  'ToastProvider empty': [],
  'BootSplash loading': [],
  'BootSplash error': [],
  'SkillsPanel empty': [],
  'SkillsPanel populated': [],
  'QuickActionsPopover empty': [],
  'QuickActionsPopover populated': [],
  'AppScopePanel open': [],
} satisfies Record<string, ReadonlyArray<string>>;

export type A11yCase = keyof typeof A11Y_BASELINE;

export const expectBaseline = async ({
  name,
  container,
}: {
  name: A11yCase;
  container: Element;
}) => {
  const { violations } = await runA11yCheck(container);
  const found = violations.map((violation) => violation.id).sort();
  const baseline: ReadonlyArray<string> = A11Y_BASELINE[name];
  const expected = [...baseline].sort();
  expect(
    found,
    `${name}: a new violation fails, and so does a fixed one until its id is deleted from A11Y_BASELINE`,
  ).toEqual(expected);
};

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
  'scene workspace': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene workflow': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene shell': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene mounts': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene mount-mismatch': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene resolve': ['heading-order', 'nested-interactive'],
  'scene board': ['nested-interactive'],
  'scene board-shell': ['nested-interactive'],
  'scene artifact-wireframe-low': ['nested-interactive'],
  'scene artifact-wireframe-high': ['nested-interactive'],
  'scene artifact-create-report': ['label'],
  'scene artifact-create-wireframe': ['label'],
  'scene activity': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene activity-filter': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene activity-run': ['aria-allowed-role', 'aria-prohibited-attr'],
  'scene workflow-builder': ['label'],
  'scene resolve-queue-shell': ['heading-order', 'nested-interactive'],
  'scene resolve-publish-blocked': ['heading-order', 'nested-interactive'],
  'scene artifacts-lens-shell': ['landmark-unique'],
  'scene lens-switcher': ['heading-order', 'nested-interactive'],
  'scene lens-switcher-closed': ['heading-order', 'nested-interactive'],
  'scene providers': ['nested-interactive'],
} satisfies Record<string, ReadonlyArray<string>>;

const BASELINE_BY_CASE: Readonly<Record<string, ReadonlyArray<string>>> = A11Y_BASELINE;

export const expectBaseline = async ({ name, container }: { name: string; container: Element }) => {
  const { violations } = await runA11yCheck(container);
  const found = violations.map((violation) => violation.id).sort();
  const expected = [...(BASELINE_BY_CASE[name] ?? [])].sort();
  expect(
    found,
    `${name}: a new violation fails, and so does a fixed one until its id is deleted from A11Y_BASELINE`,
  ).toEqual(expected);
};

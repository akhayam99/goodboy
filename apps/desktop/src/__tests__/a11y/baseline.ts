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
  'scene workspace': [],
  'scene workflow': [],
  'scene shell': [],
  'scene mounts': [],
  'scene mount-mismatch': [],
  'scene resolve': [],
  'scene board': [],
  'scene board-shell': [],
  'scene artifact-wireframe-low': ['nested-interactive'],
  'scene artifact-wireframe-high': ['nested-interactive'],
  'scene artifact-create-report': ['label'],
  'scene artifact-create-wireframe': ['label'],
  'scene activity': [],
  'scene activity-filter': [],
  'scene activity-run': [],
  'scene workflow-builder': ['label'],
  'scene resolve-queue-shell': [],
  'scene resolve-publish-blocked': [],
  'scene artifacts-lens-shell': [],
  'scene lens-switcher': [],
  'scene lens-switcher-closed': [],
  'scene session-states': [],
  'scene session-start': [],
  'scene workspace-states': [],
  'scene review-modes': [],
  'scene workflow-studio': ['label'],
  'scene workflow-builder-modes': ['label'],
  'scene brand-lookup': ['aria-required-parent'],
  'scene brand-history': ['label'],
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

import type { ComponentType } from 'react';
import { ChecksAnalyzeScene } from './ChecksAnalyzeScene';
import { FixCommentsScene } from './FixCommentsScene';

export const U24_FIX_HINTS_SCENES: Readonly<Record<string, ComponentType>> = {
  'fixcomments-hint-filled': () => (
    <FixCommentsScene
      phase="selected"
      hint="Skip the naming nit and focus on the null check in errorShape.ts."
    />
  ),
  'debugger-drawer-hint-filled': () => (
    <ChecksAnalyzeScene
      phase="proposal"
      shouldOpenDrawer
      hint="Keep the guard inside ledger.ts and add the retry test next to the existing one. Leave the migration alone."
    />
  ),
};

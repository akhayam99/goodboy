import type { ComponentType } from 'react';
import { ChecksAnalyzeScene } from '../u24/ChecksAnalyzeScene';
import { DEBUGGER_OPTIONS_TEXT, DEBUGGER_RAW_LOG } from './debuggerSeed';

export const U25_DEBUGGER_SCENES: Readonly<Record<string, ComponentType>> = {
  'debugger-drawer-options': () => (
    <ChecksAnalyzeScene phase="proposal" shouldOpenDrawer analysisText={DEBUGGER_OPTIONS_TEXT} />
  ),
  'debugger-drawer-ci-log': () => (
    <ChecksAnalyzeScene phase="proposal" shouldOpenDrawer log={DEBUGGER_RAW_LOG} />
  ),
};

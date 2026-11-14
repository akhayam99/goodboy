import type { ComponentType } from 'react';
import { CTX_PATCH } from '../brand/contextDiffPatch';
import { CHANGES_300_FILES_PATCH } from './changesSplitPatch';
import { ChangesSplitScene } from './ChangesSplitScene';

export const U42_CHANGES_SPLIT_SCENES: Readonly<Record<string, ComponentType>> = {
  'changes-3-files': () => <ChangesSplitScene patch={CTX_PATCH} theme="light" />,
  'changes-3-files-dark': () => <ChangesSplitScene patch={CTX_PATCH} theme="dark" />,
  'changes-3-files-setup': () => (
    <ChangesSplitScene patch={CTX_PATCH} theme="light" hasSetupOffer />
  ),
  'changes-300-files': () => <ChangesSplitScene patch={CHANGES_300_FILES_PATCH} theme="light" />,
  'changes-300-files-dark': () => (
    <ChangesSplitScene patch={CHANGES_300_FILES_PATCH} theme="dark" />
  ),
};

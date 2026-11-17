import type { ComponentType } from 'react';
import { ScribeProposalFailedScene } from '../ScribeProposalFailedScene';
import { NoGhPublishScene } from './NoGhPublishScene';
import { ProvidersScopeScene } from './ProvidersScopeScene';
import { WireframeFailedScene } from './WireframeFailedScene';

export const U23_POLICY_FAILURES_SCENES: Readonly<Record<string, ComponentType>> = {
  'settings-providers-scope': ProvidersScopeScene,
  'wireframe-failed': WireframeFailedScene,
  'scribe-failed': ScribeProposalFailedScene,
  'first-lap-publish-no-gh': NoGhPublishScene,
};

import type { ComponentType } from 'react';
import { ScribeProposalFailedScene } from '../ScribeProposalFailedScene';
import { NoGhPublishScene } from './NoGhPublishScene';
import { ProvidersScopeScene } from './ProvidersScopeScene';
import { RunDefaultsLinkScene } from './RunDefaultsLinkScene';
import { WireframeFailedScene } from './WireframeFailedScene';

export const U23_POLICY_FAILURES_SCENES: Readonly<Record<string, ComponentType>> = {
  'settings-providers-scope': ProvidersScopeScene,
  'settings-run-defaults-link': RunDefaultsLinkScene,
  'wireframe-failed': WireframeFailedScene,
  'scribe-failed': ScribeProposalFailedScene,
  'first-lap-publish-no-gh': NoGhPublishScene,
};

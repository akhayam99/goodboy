import type { OverrideSettings } from '@goodboy/types';

type Params = {
  readonly attributionFooter: boolean | null;
};

export const overridesWithAttribution = ({ attributionFooter }: Params): OverrideSettings => ({
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
});

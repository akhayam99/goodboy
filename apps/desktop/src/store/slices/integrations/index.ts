import { connectBitbucket } from './connectBitbucket';
import { connectGitlab } from './connectGitlab';
import { connectJira } from './connectJira';
import { connectLinear } from './connectLinear';
import { connectSentry } from './connectSentry';
import { connectSlack } from './connectSlack';
import { disconnectGithub } from './disconnectGithub';
import { disconnectIntegration } from './disconnectIntegration';
import { forgetIntegrationCredential } from './forgetIntegrationCredential';
import { loadIntegrationCredentials } from './loadIntegrationCredentials';
import { loadIntegrations } from './loadIntegrations';
import type { GetFn, SetFn } from './types';

export const createIntegrationsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadIntegrations: loadIntegrations(set, get),
    loadIntegrationCredentials: loadIntegrationCredentials(set),
    forgetIntegrationCredential: forgetIntegrationCredential(set, get),
    disconnectIntegration: disconnectIntegration(set, get),
    connectLinear: connectLinear(set, get),
    connectSentry: connectSentry(set, get),
    connectGitlab: connectGitlab(set, get),
    connectJira: connectJira(set, get),
    connectBitbucket: connectBitbucket(set, get),
    connectSlack: connectSlack(set, get),
    disconnectGithub: disconnectGithub(),
  };
};

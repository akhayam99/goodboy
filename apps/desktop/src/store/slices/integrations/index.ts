import { connectBitbucket } from './connectBitbucket';
import { declineIntegrationReuse } from './declineIntegrationReuse';
import { connectGitlab } from './connectGitlab';
import { connectJira } from './connectJira';
import { connectLinear } from './connectLinear';
import { connectSentry } from './connectSentry';
import { connectSlack } from './connectSlack';
import { disconnectBitbucket } from './disconnectBitbucket';
import { disconnectGithub } from './disconnectGithub';
import { disconnectGitlab } from './disconnectGitlab';
import { disconnectJira } from './disconnectJira';
import { disconnectLinear } from './disconnectLinear';
import { disconnectSentry } from './disconnectSentry';
import { disconnectSlack } from './disconnectSlack';
import { loadIntegrations } from './loadIntegrations';
import { reuseIntegration } from './reuseIntegration';
import type { GetFn, SetFn } from './types';

export const createIntegrationsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadIntegrations: loadIntegrations(set),
    reuseIntegration: reuseIntegration(set, get),
    declineIntegrationReuse: declineIntegrationReuse(set),
    connectLinear: connectLinear(set, get),
    disconnectLinear: disconnectLinear(set),
    connectSentry: connectSentry(set, get),
    disconnectSentry: disconnectSentry(set),
    connectGitlab: connectGitlab(set, get),
    disconnectGitlab: disconnectGitlab(set),
    connectJira: connectJira(set, get),
    disconnectJira: disconnectJira(set),
    connectBitbucket: connectBitbucket(set, get),
    disconnectBitbucket: disconnectBitbucket(set),
    connectSlack: connectSlack(set, get),
    disconnectSlack: disconnectSlack(set),
    disconnectGithub: disconnectGithub(),
  };
};

import { connectBitbucket } from './connectBitbucket';
import { connectGitlab } from './connectGitlab';
import { connectJira } from './connectJira';
import { connectLinear } from './connectLinear';
import { connectSentry } from './connectSentry';
import { connectSlack } from './connectSlack';
import { disconnectBitbucket } from './disconnectBitbucket';
import { disconnectGitlab } from './disconnectGitlab';
import { disconnectJira } from './disconnectJira';
import { disconnectLinear } from './disconnectLinear';
import { disconnectSentry } from './disconnectSentry';
import { disconnectSlack } from './disconnectSlack';
import { loadIntegrations } from './loadIntegrations';
import type { GetFn, SetFn } from './types';

export const createIntegrationsSlice = (set: SetFn, get: GetFn) => {
  return {
    loadIntegrations: loadIntegrations(set),
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
  };
};

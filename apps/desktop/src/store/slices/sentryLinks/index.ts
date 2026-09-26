import { linkSentryProject } from './linkSentryProject';
import { loadProjectSentryLinks } from './loadProjectSentryLinks';
import { sentryLinksInitialState } from './state';
import type { GetFn, SentryLinksSlice, SetFn } from './types';
import { unlinkSentryProject } from './unlinkSentryProject';

export const createSentryLinksSlice = (set: SetFn, get: GetFn): SentryLinksSlice => ({
  ...sentryLinksInitialState,
  loadProjectSentryLinks: loadProjectSentryLinks(set),
  linkSentryProject: linkSentryProject(get),
  unlinkSentryProject: unlinkSentryProject(get),
});

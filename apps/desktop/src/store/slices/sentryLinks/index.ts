import { linkSentryProject } from './linkSentryProject';
import { loadProjectSentryLinks } from './loadProjectSentryLinks';
import { sentryLinksInitialState } from './state';
import type { SentryLinksSlice } from './types';
import { unlinkSentryProject } from './unlinkSentryProject';
import type { SliceDeps } from '../../slice-types';

export const createSentryLinksSlice = ({ set, get }: SliceDeps): SentryLinksSlice => ({
  ...sentryLinksInitialState,
  loadProjectSentryLinks: loadProjectSentryLinks(set),
  linkSentryProject: linkSentryProject(get),
  unlinkSentryProject: unlinkSentryProject(get),
});

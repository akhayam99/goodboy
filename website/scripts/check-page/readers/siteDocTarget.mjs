import { FEATURE_DOCS_DIRECTORY, SITE_DOCS_PREFIX } from '../constants.mjs';

export const siteDocTarget = ({ href }) => {
  const [area, anchor] = href.slice(SITE_DOCS_PREFIX.length).split('#');
  return [`${FEATURE_DOCS_DIRECTORY}/${area}.md`, anchor];
};

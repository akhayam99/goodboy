import { REPO_BLOB_PREFIX, SITE_DOCS_PREFIX } from '../constants.mjs';
import { anchorsOf } from '../readers/anchorsOf.mjs';
import { siteDocTarget } from '../readers/siteDocTarget.mjs';

export const checkLinks = ({ fail, rules, clusterIds, isMarketing }) => {
  rules.seeMoreLinks.forEach((href) => {
    const match = (href ?? '').match(/^\/features#(.+)$/);
    if (match === null || !clusterIds.includes(match[1])) {
      fail(`see-more link ${href} is not /features# with a cluster id`);
    }
  });
  rules.guideLinks.forEach((link) => {
    const isContentDocLink = !isMarketing && link.href.startsWith(SITE_DOCS_PREFIX);
    if (!link.isAllowed && !isContentDocLink) {
      fail(`doc link ${link.href} sits outside .refLink and the footer`);
    }
    const [path, anchor = null] = link.href.startsWith(SITE_DOCS_PREFIX)
      ? siteDocTarget({ href: link.href })
      : link.href.slice(REPO_BLOB_PREFIX.length).split('#');
    const isGuide = path === 'FEATURES.md' || /^docs\/features\/[a-z-]+\.md$/.test(path);
    if (!isGuide) {
      fail(`doc link ${link.href} is neither FEATURES.md nor a docs/features/<area>.md file`);
      return;
    }
    const anchors = anchorsOf({ file: path });
    if (anchors === null) {
      fail(`doc link ${link.href} points at a file that does not exist`);
    } else if (anchor !== null && !anchors.includes(anchor)) {
      fail(`doc link ${link.href} has no matching heading in ${path}`);
    }
  });
};

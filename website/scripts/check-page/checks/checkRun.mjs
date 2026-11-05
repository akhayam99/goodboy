import { MARKETING_PAGES } from '../constants.mjs';
import { checkBoards } from './checkBoards.mjs';
import { checkBrandMarks } from './checkBrandMarks.mjs';
import { checkEveryPage } from './checkEveryPage.mjs';
import { checkFeatures } from './checkFeatures.mjs';
import { checkHome } from './checkHome.mjs';
import { checkLinks } from './checkLinks.mjs';
import { checkMarketing } from './checkMarketing.mjs';
import { checkSections } from './checkSections.mjs';
import { checkTouch } from './checkTouch.mjs';

const PAGE_BUDGETS = {
  home: { heightByViewport: { desktop: 5000, phone: 6000 }, sectionMaxPx: 1100 },
  features: {
    heightByViewport: { desktop: 8400, phone: 11500 },
    clusterMaxByViewport: { desktop: 900, phone: 1300 },
  },
};

export const checkRun = ({
  page,
  viewport,
  theme,
  probe,
  rules,
  touch,
  groups,
  clusterIds,
  brands,
}) => {
  const label = `${viewport.name} ${theme}`;
  const failures = [];
  const fail = (message) => failures.push(`${label}: ${message}`);
  const budget = PAGE_BUDGETS[page] ?? {};
  const isMarketing = MARKETING_PAGES.includes(page);
  const shared = { fail, probe, rules, viewport };
  checkEveryPage({ ...shared, budget });
  checkBoards(shared);
  checkSections({ ...shared, groups });
  checkBrandMarks({ ...shared, brands });
  checkLinks({ ...shared, clusterIds, isMarketing });
  checkTouch({ ...shared, page, touch, isMarketing });
  if (isMarketing) {
    checkMarketing(shared);
  }
  if (page === 'features') {
    checkFeatures({ ...shared, budget });
  }
  if (page === 'home') {
    checkHome(shared);
  }
  return failures;
};

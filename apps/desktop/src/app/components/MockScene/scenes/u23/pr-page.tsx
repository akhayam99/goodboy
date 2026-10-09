import { PrPageScene } from './PrPageScene';

export const U23_PR_PAGE_SCENES = {
  'branch-pr-github': () => <PrPageScene variant="github" />,
  'branch-pr-draft': () => <PrPageScene variant="draft" />,
  'branch-pr-editing': () => <PrPageScene variant="editing" />,
  'branch-pr-none': () => <PrPageScene variant="none" />,
  'branch-pr-merge-blocked': () => <PrPageScene variant="merge-blocked" />,
  'branch-pr-merge-methods': () => <PrPageScene variant="merge-methods" />,
  'branch-pr-narrow': () => <PrPageScene variant="narrow" />,
  'branch-pr-merged': () => <PrPageScene variant="merged" />,
};

import { Fragment } from '../components/Fragment';
import { DEV_DIFF, DEV_PR } from '../figures';

export const Developers = () => (
  <Fragment
    id="developers"
    eyebrow="For developers"
    eyebrowKind="audience"
    heading="Each change arrives as a draft pull request"
    body="Agents work in their own copy of each repo and open the pull request as a draft. You read the diff before anything merges."
    figures={[DEV_PR, DEV_DIFF]}
    isMirrored
  />
);

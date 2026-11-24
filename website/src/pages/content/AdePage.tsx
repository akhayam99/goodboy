import type { Crumb } from '../../lib/Crumb';
import { AdeCompare } from './AdeCompare';
import { AdeCta } from './AdeCta';
import { AdeFaq } from './AdeFaq';
import { AdeJobs } from './AdeJobs';
import { ADE_GUIDE } from './adeGuide';
import { ContentPage } from './ContentPage';

type Props = {
  readonly crumbs: readonly Crumb[];
};

export const AdePage = ({ crumbs }: Props) => (
  <ContentPage crumbs={crumbs} title={ADE_GUIDE.title} lead={ADE_GUIDE.definition}>
    <AdeCompare />
    <AdeJobs />
    <AdeFaq />
    <AdeCta />
  </ContentPage>
);

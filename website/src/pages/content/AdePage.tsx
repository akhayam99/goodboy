import type { Crumb } from '../../lib/Crumb';
import { AdeCompare } from './AdeCompare';
import { AdeGuides } from './AdeGuides';
import { AdeJobs } from './AdeJobs';
import { ADE_GUIDE } from './adeGuide';
import { ContentPage } from './ContentPage';
import { GuideCta } from './GuideCta';
import { GuideFaq } from './GuideFaq';

type Props = {
  readonly crumbs: readonly Crumb[];
};

export const AdePage = ({ crumbs }: Props) => (
  <ContentPage crumbs={crumbs} title={ADE_GUIDE.title} lead={ADE_GUIDE.definition}>
    <AdeCompare />
    <AdeJobs />
    <AdeGuides />
    <GuideFaq faq={ADE_GUIDE.faq} />
    <GuideCta cta={ADE_GUIDE.cta} />
  </ContentPage>
);

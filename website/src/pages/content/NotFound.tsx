import { SITE } from '../../site';
import { ContentPage } from './ContentPage';

export const NotFound = () => (
  <ContentPage
    crumbs={[]}
    title="This page isn't here"
    lead="The link may be old, or the page has moved. Try one of these instead."
    links={
      <>
        <a className="btn" href="/">
          Go to the home page
        </a>
        <a className="refLink" href={SITE.features}>
          Features
        </a>
        <a className="refLink" href={SITE.docs}>
          Docs
        </a>
        <a className="refLink" href={SITE.changelog}>
          Changelog
        </a>
      </>
    }
  />
);

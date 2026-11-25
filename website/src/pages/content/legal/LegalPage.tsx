import { Fragment } from 'react';
import { SITE } from '../../../lib/site';
import type { Crumb } from '../../../lib/Crumb';
import { ContentPage } from '../ContentPage';
import { formatDate } from '../formatDate';
import type { LegalSection } from './LegalSection';

type Props = {
  readonly crumbs: readonly Crumb[];
  readonly title: string;
  readonly lead: string;
  readonly updated: string;
  readonly sections: readonly LegalSection[];
};

export const LegalPage = ({ crumbs, title, lead, updated, sections }: Props) => (
  <ContentPage
    crumbs={crumbs}
    title={title}
    lead={lead}
    links={
      <>
        <time className="cpDate" dateTime={updated}>
          Last updated {formatDate(updated)}
        </time>
        <a className="refLink" href={`mailto:${SITE.controller.email}`}>
          Email the controller
        </a>
      </>
    }
  >
    <div className="prose">
      {sections.map((section) => (
        <Fragment key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items === undefined ? null : (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  </ContentPage>
);

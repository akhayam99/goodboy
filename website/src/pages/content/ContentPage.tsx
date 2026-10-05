import './ContentPage.css';
import type { ReactNode } from 'react';
import { Statement } from '../../components/Statement';
import { Breadcrumbs, type Crumb } from './Breadcrumbs';

type Props = {
  readonly crumbs: readonly Crumb[];
  readonly title: string;
  readonly lead?: ReactNode;
  readonly links?: ReactNode;
  readonly children?: ReactNode;
};

export const ContentPage = ({ crumbs, title, lead, links, children }: Props) => (
  <main id="main" className="contentPage">
    <div className="shell">
      <div className="cpPage">
        <div className="cpHead">
          {crumbs.length > 1 ? <Breadcrumbs crumbs={crumbs} /> : null}
          <Statement headingId="page-title" heading={title} lead={lead} level={1}>
            {links === undefined ? null : <div className="ctaRow cpLinks">{links}</div>}
          </Statement>
        </div>
        {children}
      </div>
    </div>
  </main>
);

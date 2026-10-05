import { inject } from '@vercel/analytics';
import { mountRoot } from '../../mountRoot';
import { Nav, type NavSection } from '../../sections/Nav';
import '../../styles.css';
import '../../styles/consent.css';
import '../../components/Statement.css';
import '../../sections/Footer.css';
import './ContentPage.css';

const SECTIONS: readonly NavSection[] = ['home', 'features', 'docs', 'changelog', 'none'];

const isSection = (value: string | undefined): value is NavSection =>
  SECTIONS.some((section) => section === value);

const navRoot = document.getElementById('nav-root');

if (navRoot !== null) {
  const section = navRoot.dataset.nav;
  mountRoot({
    container: navRoot,
    children: <Nav current={isSection(section) ? section : 'none'} />,
  });
}

inject();

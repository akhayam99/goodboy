import { inject } from '@vercel/analytics';
import { mountRoot } from '../../lib/mountRoot';
import { Nav, type NavSection } from '../home/sections/Nav';
import '../../styles/base.css';
import '../../styles/consent.css';
import '../../components/Statement.css';
import '../home/sections/Footer.css';
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

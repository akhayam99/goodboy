import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import { Nav, type NavSection } from '../../sections/Nav';
import '../../styles.css';
import '../../styles/consent.css';
import '../../components/Statement.css';
import '../../sections/Footer.css';
import './ContentPage.css';

const SECTIONS: readonly NavSection[] = ['home', 'features', 'docs', 'changelog', 'none'];

const isSection = (value: string | undefined): value is NavSection =>
  SECTIONS.some((section) => section === value);

const navRoot = document.getElementById('nav-root')!;
const section = navRoot.dataset.nav;

hydrateRoot(
  navRoot,
  <StrictMode>
    <Nav current={isSection(section) ? section : 'none'} />
  </StrictMode>,
);

inject();

import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { Sessions } from './sections/Sessions';
import { Teams } from './sections/Teams';
import { Workflows } from './sections/Workflows';
import { Routing } from './sections/Routing';
import { Faq } from './sections/Faq';
import { Install } from './sections/Install';
import { Support } from './sections/Support';
import { Closer } from './sections/Closer';
import { Footer } from './sections/Footer';
import { useReveal } from './hooks/useReveal';

export const App = () => {
  useReveal();

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Providers />
        <Sessions />
        <Teams />
        <Workflows />
        <Routing />
        <Faq />
        <Install />
        <Support />
        <Closer />
      </main>
      <Footer />
      <Analytics />
    </>
  );
};

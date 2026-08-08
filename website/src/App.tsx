import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useRevealAll } from './components/Reveal';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { How } from './sections/How';
import { Briefing } from './sections/Briefing';
import { Board } from './sections/Board';
import { Context } from './sections/Context';
import { Integrations } from './sections/Integrations';
import { Routing } from './sections/Routing';
import { BuiltFor } from './sections/BuiltFor';
import { AlsoInApp } from './sections/AlsoInApp';
import { Privacy } from './sections/Privacy';
import { Faq } from './sections/Faq';
import { Install } from './sections/Install';
import { Closer } from './sections/Closer';
import { Footer } from './sections/Footer';

export const App = () => {
  useRevealAll();

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Providers />
        <How />
        <Briefing />
        <Board />
        <Context />
        <Integrations />
        <Routing />
        <BuiltFor />
        <AlsoInApp />
        <Privacy />
        <Faq />
        <Install />
        <Closer />
      </main>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </>
  );
};

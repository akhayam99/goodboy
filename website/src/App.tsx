import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Solutions } from './sections/Solutions';
import { Ship, Resolve } from './sections/Ship';
import { Issues } from './sections/Issues';
import { Routing } from './sections/Routing';
import { Fanout } from './sections/Fanout';
import { Budget } from './sections/Budget';
import { Workflows } from './sections/Workflows';
import { Terminal } from './sections/Terminal';
import { Skills } from './sections/Skills';
import { Proof } from './sections/Proof';
import { MoreBriefly } from './sections/MoreBriefly';
import { Faq } from './sections/Faq';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';

export const App = () => {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <Nav />
      <main>
        <Hero />
        <Solutions />
        <Issues />
        <Routing />
        <Fanout />
        <Workflows />
        <Budget />
        <Ship />
        <Resolve />
        <Terminal />
        <Skills />
        <MoreBriefly />
        <Proof />
        <Faq />
        <CTA />
        <div aria-hidden className="sr-only">
          <span id="problem" />
          <span id="solution" />
          <span id="shift" />
          <span id="studios" />
          <span id="studio" />
          <span id="linear" />
          <span id="sessions" />
          <span id="board" />
          <span id="context" />
          <span id="providers" />
          <span id="diff" />
          <span id="budget" />
          <span id="github" />
          <span id="workspaces" />
          <span id="compare" />
          <span id="note" />
        </div>
      </main>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </div>
  );
};

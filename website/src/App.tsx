import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Solutions } from './sections/Solutions';
import { Proof } from './sections/Proof';
import { MoreBriefly } from './sections/MoreBriefly';
import { Faq } from './sections/Faq';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';

export const App = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <main>
        <Hero />
        <Solutions />
        <Proof />
        <MoreBriefly />
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
          <span id="workflows" />
          <span id="providers" />
          <span id="diff" />
          <span id="budget" />
          <span id="github" />
          <span id="terminal" />
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

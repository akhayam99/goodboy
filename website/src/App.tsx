import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useRevealAll } from './components/Reveal';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { Orchestrator } from './sections/Orchestrator';
import { Briefing } from './sections/Briefing';
import { Roles } from './sections/Roles';
import { Workspace } from './sections/Workspace';
import { Extras } from './sections/Extras';
import { Activity } from './sections/Activity';
import { Artifacts } from './sections/Artifacts';
import { Routing } from './sections/Routing';
import { Integrations } from './sections/Integrations';
import { Privacy } from './sections/Privacy';
import { Faq } from './sections/Faq';
import { Install } from './sections/Install';
import { Footer } from './sections/Footer';

export const App = () => {
  useRevealAll();

  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Providers />
        <Orchestrator />
        <Activity />
        <Briefing />
        <Artifacts />
        <Roles />
        <Workspace />
        <Routing />
        <Integrations />
        <Extras />
        <Privacy />
        <Faq />
        <Install />
      </main>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </>
  );
};

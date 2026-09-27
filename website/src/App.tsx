import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { HowItWorks } from './sections/HowItWorks';
import { Activity } from './sections/Activity';
import { Briefing } from './sections/Briefing';
import { Artifacts } from './sections/Artifacts';
import { Roles } from './sections/Roles';
import { Workspace } from './sections/Workspace';
import { Routing } from './sections/Routing';
import { Integrations } from './sections/Integrations';
import { Review } from './sections/Review';
import { Housekeeping } from './sections/Housekeeping';
import { Privacy } from './sections/Privacy';
import { Faq } from './sections/Faq';
import { Install } from './sections/Install';
import { Footer } from './sections/Footer';

export const App = () => (
  <>
    <Nav />
    <main id="main">
      <Hero />
      <Providers />
      <HowItWorks />
      <Activity />
      <Briefing />
      <Artifacts />
      <Roles />
      <Workspace />
      <Routing />
      <Integrations />
      <Review />
      <Housekeeping />
      <Privacy />
      <Faq />
      <Install />
    </main>
    <Footer />
    <Analytics />
  </>
);

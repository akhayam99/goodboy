import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Nav } from './sections/Nav';
import { FloatingNav } from './sections/FloatingNav';
import { Hero } from './sections/Hero';
import { Letter } from './sections/Letter';
import { LogoStrip } from './sections/LogoStrip';
import { FeatureGrid } from './sections/FeatureGrid';
import { SessionsDeepDive } from './sections/SessionsDeepDive';
import { ContextDeepDive } from './sections/ContextDeepDive';
import { PlansDeepDive } from './sections/PlansDeepDive';
import { RoutingDeepDive } from './sections/RoutingDeepDive';
import { GithubDeepDive } from './sections/GithubDeepDive';
import { Comparison } from './sections/Comparison';
import { Stack } from './sections/Stack';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';

export function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <FloatingNav />
      <main>
        <Hero />
        <Letter />
        <LogoStrip />
        <FeatureGrid />
        <SessionsDeepDive />
        <ContextDeepDive />
        <PlansDeepDive />
        <RoutingDeepDive />
        <GithubDeepDive />
        <Comparison />
        <Stack />
        <CTA />
      </main>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

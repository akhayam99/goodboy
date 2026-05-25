import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Letter } from './sections/Letter';
import { LogoStrip } from './sections/LogoStrip';
import { FeatureGrid } from './sections/FeatureGrid';
import { ContextDeepDive } from './sections/ContextDeepDive';
import { RoutingDeepDive } from './sections/RoutingDeepDive';
import { PlansDeepDive } from './sections/PlansDeepDive';
import { GithubDeepDive } from './sections/GithubDeepDive';
import { Comparison } from './sections/Comparison';
import { Stack } from './sections/Stack';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';

export function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <main>
        <Hero />
        <Letter />
        <LogoStrip />
        <FeatureGrid />
        <ContextDeepDive />
        <RoutingDeepDive />
        <PlansDeepDive />
        <GithubDeepDive />
        <Comparison />
        <Stack />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Nav } from './sections/Nav';
import { FloatingNav } from './sections/FloatingNav';
import { Hero } from './sections/Hero';
import { SessionsDeepDive } from './sections/SessionsDeepDive';
import { ContextDeepDive } from './sections/ContextDeepDive';
import { StudioDeepDive } from './sections/StudioDeepDive';
import { GithubDeepDive } from './sections/GithubDeepDive';
import { MoreBriefly } from './sections/MoreBriefly';
import { Letter } from './sections/Letter';
import { Comparison } from './sections/Comparison';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';

export function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Nav />
      <FloatingNav />
      <main>
        {/* above the fold: the reason + install/github + app overview */}
        <Hero />
        {/* the key points first: features carry the page */}
        <SessionsDeepDive />
        <ContextDeepDive />
        <StudioDeepDive />
        <GithubDeepDive />
        <MoreBriefly />
        {/* the human note, after the features, before the close */}
        <Letter />
        {/* close */}
        <Comparison />
        <CTA />
      </main>
      <Footer />
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

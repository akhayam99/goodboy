import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { Sessions } from './sections/Sessions';
import { Teams } from './sections/Teams';
import { Workflows } from './sections/Workflows';
import { Routing } from './sections/Routing';
import { WorkspaceChat } from './sections/WorkspaceChat';
import { Closer } from './sections/Closer';
import { Install } from './sections/Install';
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
        <WorkspaceChat />
        <Closer />
        <Install />
      </main>
      <Footer />
      <Analytics />
    </>
  );
};

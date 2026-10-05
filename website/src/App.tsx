import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { TwoWays } from './sections/TwoWays';
import { SharedContext } from './sections/SharedContext';
import { Tour } from './sections/Tour';
import { Install } from './sections/Install';
import { Footer } from './sections/Footer';
import { useReveal } from './hooks/useReveal';

export const App = () => {
  useReveal();
  return (
    <>
      <Nav current="home" />
      <main id="main">
        <Hero />
        <TwoWays />
        <SharedContext />
        <Tour />
        <Install />
      </main>
      <Footer />
      <Analytics />
    </>
  );
};

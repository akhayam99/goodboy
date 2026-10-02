import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { TwoWays } from './sections/TwoWays';
import { SharedContext } from './sections/SharedContext';
import { Tour } from './sections/Tour';
import { Install } from './sections/Install';
import { Footer } from './sections/Footer';
import { FidelityView } from './components/FidelityView';
import { useReveal } from './hooks/useReveal';

export const App = () => {
  useReveal();
  const mock = new URLSearchParams(window.location.search).get('fidelity');
  if (mock !== null) {
    return <FidelityView mock={mock} />;
  }
  return (
    <>
      <Nav />
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

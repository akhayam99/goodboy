import { Analytics } from '@vercel/analytics/react';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { Providers } from './sections/Providers';
import { JobsAndModels } from './sections/JobsAndModels';
import { WhatNeedsYou } from './sections/WhatNeedsYou';
import { StopReexplaining } from './sections/StopReexplaining';
import { AlsoIn } from './sections/AlsoIn';
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
        <JobsAndModels />
        <WhatNeedsYou />
        <StopReexplaining />
        <AlsoIn />
        <Install />
      </main>
      <Footer />
      <Analytics />
    </>
  );
};

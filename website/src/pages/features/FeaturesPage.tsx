import { Analytics } from '@vercel/analytics/react';
import { Statement } from '../../components/Statement';
import { Features } from '../../sections/Features';
import { Footer } from '../../sections/Footer';
import { Nav } from '../../sections/Nav';
import { Tools } from '../../sections/Tools';

export const FeaturesPage = () => (
  <>
    <Nav />
    <main id="main" className="featuresPage">
      <div className="shell">
        <div className="featuresPageInner">
          <Statement
            headingId="features-title"
            eyebrow="All features"
            eyebrowKind="page"
            heading="What Goodboy does, group by group"
            lead="Everything in the app, in the order a task lives, from set up to clean up. Pick a release to see what it added."
            level={1}
          />
          <Features />
          <Tools />
        </div>
      </div>
    </main>
    <Footer />
    <Analytics />
  </>
);

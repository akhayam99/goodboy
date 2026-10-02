import './FeaturesPage.css';
import { Analytics } from '@vercel/analytics/react';
import { StarButton } from '../../components/StarButton';
import { Statement } from '../../components/Statement';
import { LATEST_VERSION } from '../../data/latestVersion';
import { Footer } from '../../sections/Footer';
import { Nav } from '../../sections/Nav';
import { useReveal } from '../../hooks/useReveal';
import { SITE } from '../../site';
import { Cluster, type FeatureCluster } from './Cluster';
import { ClusterRail } from './ClusterRail';
import data from './features.data.json';

const CLUSTERS = data.clusters as readonly FeatureCluster[];
const RAIL = CLUSTERS.map((cluster) => ({ id: cluster.id, title: cluster.title }));

export const FeaturesPage = () => {
  useReveal();

  return (
    <>
      <Nav />
      <main id="main" className="featuresPage">
        <div className="shell">
          <div className="ftPage">
            <Statement
              headingId="features-title"
              eyebrow="All features"
              eyebrowKind="page"
              heading="Everything Goodboy does"
              lead="Nine groups, from setup to storage. Each shows the main features, with a picture."
              level={1}
            >
              <div className="ctaRow ftHeadLinks">
                <StarButton />
                <a className="refLink" href={SITE.featureGuide}>
                  Full reference on GitHub
                </a>
                {LATEST_VERSION === '' ? null : (
                  <a className="refLink" href={SITE.changelog}>
                    New in {LATEST_VERSION}
                  </a>
                )}
              </div>
            </Statement>
            <div className="ftBody">
              <ClusterRail items={RAIL} />
              <div className="ftClusters">
                {CLUSTERS.map((cluster) => (
                  <Cluster key={cluster.id} cluster={cluster} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <Analytics />
    </>
  );
};

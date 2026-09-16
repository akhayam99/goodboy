import { useEffect, useState } from 'react';
import { ArtifactStudio } from '../../../../features/artifacts/components/ArtifactStudio';
import { CreateReportCta } from '../../../../features/reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../../features/wireframes/components/CreateWireframeCta';
import { SESSION_ID, seedArtifactScene } from './artifactSeed';

const openRailCard = ({ title }: { readonly title: string }): boolean => {
  const rail = window.document.querySelector('[data-testid="artifact-rail"]');
  if (rail === null) {
    return window.document.querySelector('[data-testid="artifact-export-slot"]') !== null;
  }
  const card = [...rail.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(title),
  );
  card?.click();
  return card !== undefined;
};

const ArtifactScene = ({ title }: { readonly title: string }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedArtifactScene();
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      if (openRailCard({ title })) {
        window.clearInterval(interval);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, title]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border-soft px-4 py-2">
        <CreateReportCta sessionId={SESSION_ID} />
        <CreateWireframeCta sessionId={SESSION_ID} />
      </div>
      <div className="min-h-0 flex-1">
        <ArtifactStudio sessionId={SESSION_ID} />
      </div>
    </main>
  );
};

export const ArtifactReportScene = () => (
  <ArtifactScene title="Rounding drift in ledger-core postings" />
);

export const ArtifactWireframeLowScene = () => <ArtifactScene title="Settlement review flow" />;

export const ArtifactWireframeHighScene = () => (
  <ArtifactScene title="Settlement review flow, themed" />
);

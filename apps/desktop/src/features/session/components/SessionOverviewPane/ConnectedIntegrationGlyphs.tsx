import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
import { useRemoteHostKind } from '../../../worktree/useRemoteHostKind';
import { resolveIntegrationConnection } from '../../../integrations/connection';
import {
  IntegrationGlyph,
  type IntegrationGlyphProvider,
} from '../../../integrations/components/IntegrationGlyph';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

type GlyphSpec = {
  readonly glyph: IntegrationGlyphProvider;
  readonly connectionProvider: 'github' | 'gitlab' | 'linear' | 'sentry';
  readonly lens: LensKind;
  readonly label: string;
};

const GLYPH_SPECS: ReadonlyArray<GlyphSpec> = [
  { glyph: 'github', connectionProvider: 'github', lens: 'pr', label: 'GitHub' },
  { glyph: 'gitlab', connectionProvider: 'gitlab', lens: 'gitlab_issues', label: 'GitLab' },
  { glyph: 'linear', connectionProvider: 'linear', lens: 'linear', label: 'Linear' },
  { glyph: 'sentry', connectionProvider: 'sentry', lens: 'sentry', label: 'Sentry' },
];

export const ConnectedIntegrationGlyphs = ({ session, onSelectLens }: Props) => {
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[session.id] ?? EMPTY_ARRAY);
  const workspaceIntegrations = useAppStore(
    (s) => s.workspaceIntegrations[session.workspaceId] ?? EMPTY_ARRAY,
  );
  const remoteKind = useRemoteHostKind(session.workspaceId);

  const connected = GLYPH_SPECS.filter(
    (spec) =>
      resolveIntegrationConnection({
        provider: spec.connectionProvider,
        integrations: workspaceIntegrations,
        remoteKind,
        externalTasks,
      }).isConnected,
  );

  if (connected.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {connected.map((spec) => (
        <button
          key={spec.glyph}
          type="button"
          onClick={() => onSelectLens(spec.lens)}
          title={`Open ${spec.label}`}
          aria-label={`Open ${spec.label}`}
          className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <IntegrationGlyph provider={spec.glyph} size={14} />
        </button>
      ))}
    </div>
  );
};

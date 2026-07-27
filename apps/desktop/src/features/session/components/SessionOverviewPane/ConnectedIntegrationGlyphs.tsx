import type { Session, SessionExternalTaskProvider } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { LensKind } from '../../../../store';
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
  readonly taskProvider: SessionExternalTaskProvider;
  readonly lens: LensKind;
  readonly label: string;
};

const GLYPH_SPECS: ReadonlyArray<GlyphSpec> = [
  { glyph: 'github', taskProvider: 'github', lens: 'pr', label: 'GitHub' },
  { glyph: 'gitlab', taskProvider: 'gitlab', lens: 'gitlab_issues', label: 'GitLab' },
  { glyph: 'linear', taskProvider: 'linear', lens: 'linear', label: 'Linear' },
  { glyph: 'sentry', taskProvider: 'sentry', lens: 'sentry', label: 'Sentry' },
];

export const ConnectedIntegrationGlyphs = ({ session, onSelectLens }: Props) => {
  const externalTasks = useAppStore((s) => s.sessionExternalTasks[session.id] ?? EMPTY_ARRAY);

  const linked = GLYPH_SPECS.filter((spec) =>
    externalTasks.some((task) => task.provider === spec.taskProvider),
  );

  if (linked.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {linked.map((spec) => (
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

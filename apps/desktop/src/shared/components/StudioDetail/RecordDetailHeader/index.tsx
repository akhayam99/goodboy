import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { HeaderBand, Input } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../../features/integrations/components/IntegrationGlyph';
import { ExternalRefActions } from '../../ExternalRefActions';

type ExternalRef = {
  readonly url: string;
  readonly label: string;
};

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly identifier: string;
  readonly title: string;
  readonly badge?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly externalRef?: ExternalRef | null;
  readonly actions?: ReactNode;
  readonly onTitleSave?: ((title: string) => void | Promise<void>) | null;
};

export const RecordDetailHeader = ({
  provider,
  identifier,
  title,
  badge,
  subtitle,
  externalRef,
  actions,
  onTitleSave,
}: Props) => {
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  const save = () => {
    const next = draft.trim();
    if (onTitleSave == null || next === '' || next === title) {
      setDraft(title);
      return;
    }
    void onTitleSave(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.currentTarget.blur();
  };

  const titleNode =
    onTitleSave == null ? (
      title
    ) : (
      <Input
        aria-label="Record title"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        className="h-auto border-0 bg-transparent px-0 py-0 text-xl font-semibold leading-snug shadow-none focus-visible:ring-0"
      />
    );

  return (
    <HeaderBand
      title={titleNode}
      meta={
        <>
          <IntegrationGlyph provider={provider} size="xs" />
          <span className="font-mono text-2xs tabular-nums text-muted-foreground">
            {identifier}
          </span>
          {badge}
        </>
      }
      subtitle={subtitle}
      actions={
        actions != null || externalRef != null ? (
          <>
            {actions}
            {externalRef != null ? (
              <ExternalRefActions
                url={externalRef.url}
                label={externalRef.label}
                hostLabel={integrationLabel({ provider })}
              />
            ) : null}
          </>
        ) : undefined
      }
    />
  );
};

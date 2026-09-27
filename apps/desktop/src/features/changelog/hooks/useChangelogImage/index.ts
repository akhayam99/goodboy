import { useEffect, useRef, useState } from 'react';
import { useAppliedTheme } from '../../../../shared/lib/theme';
import { changelogImageFileName } from '../../changelogImageFiles';
import type { ChangelogImageVariant } from '../../changelogImageFiles';
import { fetchChangelogImage } from '../../fetchChangelogImage';

export type ChangelogImageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly dataUri: string }
  | { readonly kind: 'absent' };

type Params = {
  readonly version: string;
  readonly image: string;
  readonly variant: ChangelogImageVariant;
  readonly enabled?: boolean;
};

const ABSENT: ChangelogImageState = { kind: 'absent' };
const LOADING: ChangelogImageState = { kind: 'loading' };

export const useChangelogImage = ({
  version,
  image,
  variant,
  enabled = true,
}: Params): ChangelogImageState => {
  const theme = useAppliedTheme();
  const shownFor = useRef<string | null>(null);
  const [state, setState] = useState<ChangelogImageState>(enabled ? LOADING : ABSENT);

  useEffect(() => {
    if (!enabled) {
      shownFor.current = null;
      setState(ABSENT);
      return;
    }
    let cancelled = false;
    const subject = `${version}|${image}|${variant}`;
    if (shownFor.current !== subject) {
      shownFor.current = subject;
      setState(LOADING);
    }
    const file = changelogImageFileName({ image, variant, theme });
    fetchChangelogImage({ version, file })
      .then((dataUri) => {
        if (cancelled) {
          return;
        }
        if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
          setState(ABSENT);
          return;
        }
        setState({ kind: 'ready', dataUri });
      })
      .catch(() => {
        if (!cancelled) {
          setState(ABSENT);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, version, image, variant, theme]);

  return state;
};

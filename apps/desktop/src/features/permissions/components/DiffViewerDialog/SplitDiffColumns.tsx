type Variant = 'viewer' | 'review';

const GUTTER_WIDTH = '2.25rem';
const ACTIONS_WIDTH = '2.75rem';
const SIDE_WIDTH = '50%';

export const SplitDiffColumns = ({ variant }: { readonly variant: Variant }) => (
  <colgroup>
    {variant === 'review' ? <col style={{ width: ACTIONS_WIDTH }} /> : null}
    <col style={{ width: GUTTER_WIDTH }} />
    <col style={{ width: SIDE_WIDTH }} />
    {variant === 'review' ? <col style={{ width: ACTIONS_WIDTH }} /> : null}
    <col style={{ width: GUTTER_WIDTH }} />
    <col style={{ width: SIDE_WIDTH }} />
  </colgroup>
);

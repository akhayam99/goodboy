// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ARTIFACT_GENERATION_PRESENTATION } from '../../features/artifacts/artifactCollection';
import { ARTIFACT_CTA_BLOCK_COPY } from '../../features/artifacts/artifactCtaState';
import { REVIEW_COMMENT_GROUP_LABEL } from '../../features/resolve/reviewCommentState';
import { COMPOSE_COPY, REVIEW_FLOW_LABEL } from '../../features/resolve/reviewFlowCopy';
import { SCRIPT_RUN_PRESENTATION } from '../../features/scripts/scriptRunPresentation';
import { LENS_LABEL } from '../../features/session/lens-labels';
import {
  ACTIVITY_CATEGORY_LABEL,
  ACTIVITY_PRESET_LABEL,
} from '../../features/session/timeline/activityFilter';
import { ARCHIVED_SESSION_REASON } from '../../features/session/archivedSession';
import { ROW_NODE_LABEL } from '../../features/workTreeModel/rowStateCopy';

const BRAND_LOWERCASE = ['pnpm', 'npm', 'gh', 'git'];

const NAMED_COPY: Readonly<Record<string, ReadonlyArray<string | null>>> = {
  ARTIFACT_GENERATION_PRESENTATION: Object.values(ARTIFACT_GENERATION_PRESENTATION).flatMap(
    (states) => Object.values(states).map((presentation) => presentation.label),
  ),
  ARTIFACT_CTA_BLOCK_COPY: Object.values(ARTIFACT_CTA_BLOCK_COPY),
  REVIEW_COMMENT_GROUP_LABEL: Object.values(REVIEW_COMMENT_GROUP_LABEL),
  REVIEW_FLOW_LABEL: Object.values(REVIEW_FLOW_LABEL).filter((label) => !label.startsWith('↵')),
  COMPOSE_COPY: Object.values(COMPOSE_COPY).flatMap((copy) => [copy.label, copy.submit]),
  SCRIPT_RUN_PRESENTATION: Object.values(SCRIPT_RUN_PRESENTATION).map(
    (presentation) => presentation.statusLabel,
  ),
  LENS_LABEL: Object.values(LENS_LABEL),
  ACTIVITY_CATEGORY_LABEL: Object.values(ACTIVITY_CATEGORY_LABEL),
  ACTIVITY_PRESET_LABEL: Object.values(ACTIVITY_PRESET_LABEL),
  ARCHIVED_SESSION_REASON: [ARCHIVED_SESSION_REASON],
  ROW_NODE_LABEL: Object.values(ROW_NODE_LABEL),
};

const startsLowercase = (text: string): boolean =>
  /^[a-z]/.test(text) && !BRAND_LOWERCASE.some((brand) => text.startsWith(`${brand} `));

describe('product copy casing', () => {
  it('opens every named copy map entry in sentence case', () => {
    const offenders = Object.entries(NAMED_COPY).flatMap(([map, values]) =>
      values.flatMap((value) =>
        value !== null && startsLowercase(value) ? [`${map}: ${value}`] : [],
      ),
    );

    expect(offenders).toEqual([]);
  });
});

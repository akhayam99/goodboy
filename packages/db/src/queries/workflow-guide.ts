import { brandId, type Workflow, type WorkflowId } from '@goodboy/types';
import type { Database } from '../client';

export type WorkflowGuideFields = Pick<
  Workflow,
  'entryCheck' | 'stopRule' | 'thenSuggestId' | 'isOrderKept'
>;

export type WorkflowGuideRow = {
  entry_check: string | null;
  stop_rule: string | null;
  then_suggest_id: string | null;
  is_order_kept: number;
};

type RowParams = {
  readonly row: WorkflowGuideRow;
};

export const guideFieldsOfRow = ({ row }: RowParams): WorkflowGuideFields => ({
  ...(row.entry_check != null && { entryCheck: row.entry_check }),
  ...(row.stop_rule != null && { stopRule: row.stop_rule }),
  ...(row.then_suggest_id != null && {
    thenSuggestId: brandId<WorkflowId>({ value: row.then_suggest_id }),
  }),
  ...(row.is_order_kept === 1 && { isOrderKept: true }),
});

type SourceParams = {
  readonly source: WorkflowGuideFields;
};

export const guideFieldsOf = ({ source }: SourceParams): WorkflowGuideFields => ({
  ...(source.entryCheck !== undefined && { entryCheck: source.entryCheck }),
  ...(source.stopRule !== undefined && { stopRule: source.stopRule }),
  ...(source.thenSuggestId !== undefined && { thenSuggestId: source.thenSuggestId }),
  ...(source.isOrderKept !== undefined && { isOrderKept: source.isOrderKept }),
});

export const guideUpsertParamsOf = ({
  source,
}: SourceParams): ReadonlyArray<string | number | null> => [
  source.entryCheck ?? null,
  source.stopRule ?? null,
  source.thenSuggestId ?? null,
  source.isOrderKept === true ? 1 : 0,
  ...[source.entryCheck, source.stopRule, source.thenSuggestId, source.isOrderKept].map((value) =>
    value === undefined ? 0 : 1,
  ),
];

type FillSeededGuideParams = {
  readonly db: Database;
  readonly workflowId: WorkflowId;
  readonly entryCheck: string;
  readonly stopRule: string;
  readonly thenSuggestId: WorkflowId | null;
};

export const fillSeededWorkflowGuide = async ({
  db,
  workflowId,
  entryCheck,
  stopRule,
  thenSuggestId,
}: FillSeededGuideParams): Promise<void> => {
  await db.execute(
    `UPDATE workflows
        SET then_suggest_id = CASE WHEN entry_check IS NULL AND stop_rule IS NULL
                                   THEN COALESCE(then_suggest_id, ?)
                                   ELSE then_suggest_id END,
            entry_check = COALESCE(entry_check, ?),
            stop_rule = COALESCE(stop_rule, ?)
      WHERE id = ? AND id LIKE 'wf\\_seed\\_%' ESCAPE '\\'
        AND (entry_check IS NULL OR stop_rule IS NULL)`,
    [thenSuggestId, entryCheck, stopRule, workflowId],
  );
};

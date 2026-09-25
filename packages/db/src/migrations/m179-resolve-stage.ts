export const m179ResolveStage = `
ALTER TABLE resolve_publications ADD COLUMN holder TEXT;
ALTER TABLE resolve_publications ADD COLUMN heartbeat_at INTEGER;
ALTER TABLE resolve_threads ADD COLUMN stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'working', 'asking', 'proposed', 'approved', 'publishing', 'failed', 'parked', 'resolved'));

UPDATE resolve_threads SET stage = (
  SELECT CASE
    WHEN resolve_threads.state = 'closed' THEN 'resolved'
    WHEN resolve_threads.state = 'publishing' THEN 'publishing'
    WHEN item.approval_state = 'deferred' THEN 'parked'
    WHEN item.approval_state IN ('accepted', 'wont_fix')
      AND item.approved_revision IS NOT NULL
      AND resolve_threads.revision > item.approved_revision
      AND (item.approval_state = 'wont_fix' OR attempt.phase IS NULL OR attempt.phase NOT IN ('running', 'queued'))
      AND (item.approval_state = 'wont_fix' OR resolve_threads.question IS NULL OR resolve_threads.state <> 'needs_answer')
      THEN 'proposed'
    WHEN item.approval_state = 'accepted' AND attempt.phase IN ('running', 'queued') THEN 'working'
    WHEN item.approval_state = 'accepted' AND resolve_threads.question IS NOT NULL AND resolve_threads.state = 'needs_answer' THEN 'asking'
    WHEN item.approval_state IN ('accepted', 'wont_fix') AND item.delivered_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM resolve_publication_threads receipt
      JOIN resolve_publications publication ON publication.id = receipt.publication_id
      WHERE publication.session_id = resolve_threads.session_id
        AND receipt.thread_id = resolve_threads.thread_id
        AND receipt.revision = item.approved_revision
        AND receipt.reply_phase IN ('posted', 'skipped')
        AND receipt.resolve_phase IN ('resolved', 'skipped')
    ) THEN 'resolved'
    WHEN item.approval_state IN ('accepted', 'wont_fix') AND EXISTS (
      SELECT 1 FROM resolve_publication_threads receipt
      JOIN resolve_publications publication ON publication.id = receipt.publication_id
      WHERE publication.session_id = resolve_threads.session_id
        AND receipt.thread_id = resolve_threads.thread_id
        AND receipt.revision = item.approved_revision
        AND (receipt.error IS NOT NULL OR receipt.reply_phase = 'uncertain' OR receipt.resolve_phase = 'uncertain')
    ) THEN 'failed'
    WHEN item.approval_state IN ('accepted', 'wont_fix') THEN 'approved'
    WHEN attempt.phase IN ('running', 'queued') THEN 'working'
    WHEN resolve_threads.question IS NOT NULL AND resolve_threads.state = 'needs_answer' THEN 'asking'
    WHEN attempt.phase = 'failed' THEN 'failed'
    WHEN attempt.phase = 'cancelled' THEN 'new'
    WHEN item.integrated_sha IS NOT NULL THEN 'proposed'
    WHEN resolve_threads.commit_shas_json IS NOT NULL
      AND json_valid(resolve_threads.commit_shas_json)
      AND json_array_length(resolve_threads.commit_shas_json) > 0 THEN 'proposed'
    WHEN resolve_threads.reply_draft IS NOT NULL AND trim(resolve_threads.reply_draft) <> '' THEN 'proposed'
    ELSE 'new'
  END
  FROM (SELECT 1) AS anchor
  LEFT JOIN resolve_queue_items item
    ON item.session_id = resolve_threads.session_id
    AND item.thread_id = resolve_threads.thread_id
    AND item.superseded_at IS NULL
  LEFT JOIN resolve_attempts attempt ON attempt.id = resolve_threads.active_attempt_id
);
`;

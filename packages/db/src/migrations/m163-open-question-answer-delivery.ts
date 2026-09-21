export const m163OpenQuestionAnswerDelivery = /* sql */ `
ALTER TABLE open_questions ADD COLUMN answer_delivered_at INTEGER;

UPDATE open_questions
   SET answer_delivered_at = COALESCE(answered_at, created_at)
 WHERE status = 'answered';
`;

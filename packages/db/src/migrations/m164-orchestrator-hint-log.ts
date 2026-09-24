export const m164OrchestratorHintLog = /* sql */ `
ALTER TABLE session_workflows ADD COLUMN orchestrator_hint_log TEXT;

UPDATE session_workflows
   SET orchestrator_hint_log = json_array(
         json_object(
           'id', lower(hex(randomblob(16))),
           'text', trim(orchestrator_hints),
           'createdAt', strftime('%Y-%m-%dT%H:%M:%fZ', created_at / 1000.0, 'unixepoch')
         )
       )
 WHERE orchestrator_hints IS NOT NULL
   AND trim(orchestrator_hints) <> '';
`;

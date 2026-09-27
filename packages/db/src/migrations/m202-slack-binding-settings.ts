export const m202SlackBindingSettings = `
UPDATE integration_bindings
SET config = json_set(
  json_remove(config, '$.botUserId', '$.botUserName'),
  '$.userId', COALESCE(json_extract(config, '$.botUserId'), ''),
  '$.userName', json_extract(config, '$.botUserName'),
  '$.followedChannels', json('[]'),
  '$.hasSelectedChannels', json('true'),
  '$.includePrivate', json('false'),
  '$.agentPolicy', json('{"readFollowed":"allow","readOthers":"off","reply":"ask","react":"allow"}'),
  '$.signature', json('{"agents":true,"own":false,"text":"Written with Goodboy"}')
)
WHERE provider = 'slack';
`;

export { PermissionEngine, type PermissionEngineDeps } from './engine';
export { formatToolPattern, parseArgsMatcher, parseToolPattern, type ToolMatcher } from './matcher';
export { buildClaudeFlags, type ClaudeFlagSet } from './claude-flags';
export {
  modeSupportFor,
  resolveModeFor,
  type ModeSupport,
  type ModeSupportLevel,
} from './modeSupport';
export { PermissionAuditRecorder, type AuditRecorderDeps, type AuditQuery } from './audit';
export {
  commandPrefix,
  isFilePathTool,
  oncePatternText,
  prefixRuleFor,
  type ActionTarget,
  type PrefixRule,
} from './permissionActionPatterns';

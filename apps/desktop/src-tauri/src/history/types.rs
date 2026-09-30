use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HistoryVerb {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStep {
    pub sha: String,
    pub verb: HistoryVerb,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPlanArgs {
    pub worktree_path: String,
    pub base: String,
    pub head: String,
    pub steps: Vec<HistoryStep>,
    #[serde(default)]
    pub onto: Option<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StepOutcome {
    Clean,
    Conflict,
    Empty,
    Dropped,
    Blocked,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StepPrediction {
    pub sha: String,
    pub outcome: StepOutcome,
    pub files: Vec<String>,
    pub new_sha: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlanPrediction {
    pub is_supported: bool,
    pub steps: Vec<StepPrediction>,
    pub head: Option<String>,
    pub is_tree_equal: bool,
    pub changed_files: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShaMove {
    pub from: String,
    pub to: Option<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum StopKind {
    Merge,
    Hook,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrialStop {
    pub sha: String,
    pub index: usize,
    pub kind: StopKind,
    pub files: Vec<String>,
    pub message: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrialResult {
    pub head: Option<String>,
    pub map: Vec<ShaMove>,
    pub is_tree_equal: bool,
    pub changed_files: Vec<String>,
    pub stop: Option<TrialStop>,
    pub copy_path: Option<String>,
    pub order: Vec<PlannedStep>,
    pub check: Option<TrialCheck>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrialCheck {
    pub is_passed: bool,
    pub expects_same_code: bool,
    pub problems: Vec<String>,
    pub unexpected_files: Vec<String>,
    pub removed_files: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(tag = "stage", rename_all = "kebab-case")]
pub enum TrialProgress {
    Copy,
    Step {
        index: usize,
        total: usize,
        sha: String,
    },
    Check,
    Cleanup,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlannedStep {
    pub sha: String,
    pub verb: HistoryVerb,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveBranchArgs {
    pub worktree_path: String,
    pub branch: String,
    pub expected_head: String,
    pub new_head: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreArgs {
    pub worktree_path: String,
    pub branch: String,
    pub expected_head: String,
    pub backup_ref: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum MoveOutcome {
    Moved {
        head: String,
        #[serde(rename = "backupRef")]
        backup_ref: String,
    },
    Busy {
        holder: Option<String>,
    },
    HeadMoved {
        head: String,
    },
    Blocked {
        reason: String,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryBackup {
    pub ref_name: String,
    pub sha: String,
    pub subject: String,
    pub created_at: u64,
    pub is_legacy: bool,
}

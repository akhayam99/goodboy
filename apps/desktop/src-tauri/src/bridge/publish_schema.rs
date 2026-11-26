use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tone {
    Success,
    Info,
    Warning,
    Danger,
    Primary,
    Unread,
    Merged,
    Draft,
    Neutral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StatusMarkState {
    Running,
    Merging,
    Queued,
    Question,
    Approval,
    Budget,
    Alert,
    Ready,
    Failed,
    Done,
    Merged,
    Approved,
    Closed,
    Stopped,
    Skipped,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum StatusMark {
    State { state: StatusMarkState },
    Dot { tone: Tone },
    Count { tone: Tone, text: String },
    Empty,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SessionStage {
    Attention,
    Running,
    Review,
    Building,
    Done,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AttentionReason {
    AgentError,
    PushFailed,
    OpenQuestion,
    FixNeedsYou,
    FixCouldntFix,
    UnreadReply,
    CiFailed,
    ChangesRequested,
    PrQueued,
    PrApproved,
    NeedsApproval,
    PlanApproval,
    RunStopped,
    RunPausedAtLimit,
    RunWaitsForGo,
    AutoNeedsYou,
    SlackReplyWaiting,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MergeMethod {
    Squash,
    Merge,
    Rebase,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskProvider {
    Linear,
    Sentry,
    Gitlab,
    Jira,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfferedAmount {
    pub amount: f64,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Decision {
    #[serde(rename_all = "camelCase")]
    Question {
        action_id: String,
        question_id: String,
        version: String,
        text: String,
    },
    #[serde(rename_all = "camelCase")]
    Plan {
        action_id: String,
        plan_id: String,
        plan_version: i64,
        summary: String,
    },
    #[serde(rename_all = "camelCase")]
    Permission {
        action_id: String,
        agent_id: String,
        request_id: String,
        input_hash: String,
        tool_name: String,
        input_summary: String,
    },
    #[serde(rename_all = "camelCase")]
    Limit {
        action_id: String,
        run_id: String,
        current_limit: f64,
        current_limit_text: String,
        offers: Vec<OfferedAmount>,
    },
    #[serde(rename_all = "camelCase")]
    Slack {
        action_id: String,
        draft_id: String,
        version: String,
        draft: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub epoch: i64,
    pub seq: i64,
    pub generated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NeedsYouRow {
    pub id: String,
    pub workspace_id: String,
    pub session_id: String,
    pub session_ref: Option<String>,
    pub goal: String,
    pub reason: AttentionReason,
    pub tone: Tone,
    pub mark: StatusMark,
    pub words: String,
    pub waiting_text: Option<String>,
    pub since: Option<String>,
    pub decision: Option<Decision>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NeedsYouWorkspace {
    pub workspace_id: String,
    pub name: String,
    pub move_count: i64,
    pub session_count: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NeedsYouProjection {
    #[serde(flatten)]
    pub meta: Meta,
    pub move_count: i64,
    pub session_count: i64,
    pub workspaces: Vec<NeedsYouWorkspace>,
    pub rows: Vec<NeedsYouRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub workspace_id: String,
    pub r#ref: Option<String>,
    pub goal: String,
    pub stage: SessionStage,
    pub mark: StatusMark,
    pub words: Option<String>,
    pub project_names: Vec<String>,
    pub pr_number: Option<i64>,
    pub cost_text: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLane {
    pub stage: SessionStage,
    pub title: String,
    pub count: i64,
    pub rows: Vec<SessionRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionsProjection {
    #[serde(flatten)]
    pub meta: Meta,
    pub workspace_id: String,
    pub lanes: Vec<SessionLane>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionFact {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionNotice {
    pub id: String,
    pub tone: Tone,
    pub text: String,
    pub is_mac_only: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLine {
    pub id: String,
    pub mark: StatusMark,
    pub text: String,
    pub at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionProject {
    pub name: String,
    pub branch: Option<String>,
    pub pr_number: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionProjection {
    #[serde(flatten)]
    pub meta: Meta,
    pub workspace_id: String,
    pub session_id: String,
    pub r#ref: Option<String>,
    pub goal: String,
    pub stage: SessionStage,
    pub mark: StatusMark,
    pub facts: Vec<SessionFact>,
    pub notices: Vec<SessionNotice>,
    pub needs_you: Vec<NeedsYouRow>,
    pub now: Vec<SessionLine>,
    pub next: Vec<SessionLine>,
    pub projects: Vec<SessionProject>,
    pub activity: Vec<SessionLine>,
    pub pull_request_number: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunState {
    Running,
    Paused,
    Waiting,
    Stopped,
    Done,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentState {
    Running,
    Waiting,
    Stopped,
    Done,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunLimit {
    pub amount: f64,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRow {
    pub agent_id: String,
    pub name: String,
    pub mark: StatusMark,
    pub state: AgentState,
    pub words: String,
    pub can_stop: bool,
    pub can_continue: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRow {
    pub run_id: String,
    pub title: String,
    pub mark: StatusMark,
    pub state: RunState,
    pub words: String,
    pub spend_text: Option<String>,
    pub limit: Option<RunLimit>,
    pub can_stop: bool,
    pub can_continue: bool,
    pub agents: Vec<AgentRow>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunsProjection {
    #[serde(flatten)]
    pub meta: Meta,
    pub workspace_id: String,
    pub session_id: String,
    pub runs: Vec<RunRow>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PullRequestPhase {
    Draft,
    Open,
    Approved,
    Queued,
    Merged,
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CheckState {
    Passing,
    Failing,
    Running,
    Skipped,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckRow {
    pub name: String,
    pub state: CheckState,
    pub mark: StatusMark,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewRow {
    pub author: String,
    pub words: String,
    pub mark: StatusMark,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeReadiness {
    pub is_mergeable: bool,
    pub reason: Option<String>,
    pub caveats: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainEntry {
    pub session_id: String,
    pub pr_number: i64,
    pub head_sha: String,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainOffer {
    pub action_id: String,
    pub is_busy: bool,
    pub entries: Vec<TrainEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequestProjection {
    #[serde(flatten)]
    pub meta: Meta,
    pub workspace_id: String,
    pub session_id: String,
    pub number: i64,
    pub title: String,
    pub url: String,
    pub phase: PullRequestPhase,
    pub head_sha: String,
    pub base_branch: String,
    pub head_branch: String,
    pub checks: Vec<CheckRow>,
    pub reviews: Vec<ReviewRow>,
    pub readiness: MergeReadiness,
    pub methods: Vec<MergeMethod>,
    pub merge_action_id: Option<String>,
    pub train: Option<TrainOffer>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRow {
    pub id: String,
    pub provider: TaskProvider,
    pub key: String,
    pub title: String,
    pub words: String,
    pub session_id: Option<String>,
    pub can_start: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartProject {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOffer {
    pub action_id: String,
    pub is_permitted: bool,
    pub projects: Vec<StartProject>,
    pub max_goal_length: i64,
    pub remaining_today: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksProjection {
    #[serde(flatten)]
    pub meta: Meta,
    pub workspace_id: String,
    pub count: i64,
    pub rows: Vec<TaskRow>,
    pub start: Option<StartOffer>,
}

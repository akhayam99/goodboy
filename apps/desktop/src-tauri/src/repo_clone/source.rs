#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CloneHost {
    Github,
    Gitlab,
    Bitbucket,
}

impl CloneHost {
    fn from_domain(domain: &str) -> Option<Self> {
        match domain {
            "github.com" => Some(CloneHost::Github),
            "gitlab.com" => Some(CloneHost::Gitlab),
            "bitbucket.org" => Some(CloneHost::Bitbucket),
            _ => None,
        }
    }

    pub(crate) fn domain(self) -> &'static str {
        match self {
            CloneHost::Github => "github.com",
            CloneHost::Gitlab => "gitlab.com",
            CloneHost::Bitbucket => "bitbucket.org",
        }
    }

    pub(crate) fn label(self) -> &'static str {
        match self {
            CloneHost::Github => "GitHub",
            CloneHost::Gitlab => "GitLab",
            CloneHost::Bitbucket => "Bitbucket",
        }
    }

    pub(crate) fn key(self) -> &'static str {
        match self {
            CloneHost::Github => "github",
            CloneHost::Gitlab => "gitlab",
            CloneHost::Bitbucket => "bitbucket",
        }
    }

    pub(crate) fn cli(self) -> Option<&'static str> {
        match self {
            CloneHost::Github => Some("gh"),
            CloneHost::Gitlab => Some("glab"),
            CloneHost::Bitbucket => None,
        }
    }

    fn accepts_segment_count(self, count: usize) -> bool {
        match self {
            CloneHost::Gitlab => count >= 2,
            CloneHost::Github | CloneHost::Bitbucket => count == 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CloneSource {
    pub(crate) host: CloneHost,
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) remote: String,
    pub(crate) https_remote: String,
}

struct Split<'a> {
    domain: String,
    path: &'a str,
    is_ssh: bool,
    is_scp: bool,
}

fn split_remote(raw: &str) -> Option<Split<'_>> {
    if let Some(rest) = raw.strip_prefix("https://") {
        let (domain, path) = rest.split_once('/')?;
        return Some(Split {
            domain: domain.to_ascii_lowercase(),
            path,
            is_ssh: false,
            is_scp: false,
        });
    }
    if let Some(rest) = raw.strip_prefix("ssh://git@") {
        let (domain, path) = rest.split_once('/')?;
        return Some(Split {
            domain: domain.to_ascii_lowercase(),
            path,
            is_ssh: true,
            is_scp: false,
        });
    }
    let rest = raw.strip_prefix("git@")?;
    let (domain, path) = rest.split_once(':')?;
    Some(Split {
        domain: domain.to_ascii_lowercase(),
        path,
        is_ssh: true,
        is_scp: true,
    })
}

fn is_valid_segment(segment: &str) -> bool {
    !segment.is_empty()
        && !segment.starts_with('-')
        && !segment.starts_with('.')
        && segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
}

pub(crate) fn parse_source(raw: &str) -> Option<CloneSource> {
    let trimmed = raw.trim();
    if trimmed.contains(['?', '#', ' ']) {
        return None;
    }
    let split = split_remote(trimmed)?;
    let domain = split.domain.strip_prefix("www.").unwrap_or(&split.domain);
    let host = CloneHost::from_domain(domain)?;
    let path = split.path.trim_matches('/');
    let path = path.strip_suffix(".git").unwrap_or(path);
    let segments: Vec<&str> = path.split('/').collect();
    if !host.accepts_segment_count(segments.len())
        || !segments.iter().all(|segment| is_valid_segment(segment))
    {
        return None;
    }
    let name = (*segments.last()?).to_string();
    Some(CloneSource {
        host,
        path: path.to_string(),
        name,
        remote: remote_of(&split, host, path),
        https_remote: https_remote_of(host, path),
    })
}

fn https_remote_of(host: CloneHost, path: &str) -> String {
    format!("https://{}/{path}.git", host.domain())
}

fn remote_of(split: &Split<'_>, host: CloneHost, path: &str) -> String {
    if split.is_scp {
        return format!("git@{}:{path}.git", host.domain());
    }
    if split.is_ssh {
        return format!("ssh://git@{}/{path}.git", host.domain());
    }
    https_remote_of(host, path)
}

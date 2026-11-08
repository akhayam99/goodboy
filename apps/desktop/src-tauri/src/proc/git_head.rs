use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const HEAD_REF: &str = "ref: refs/heads/";
const GITDIR_LINE: &str = "gitdir:";
const RENAME_MESSAGE: &str = "Branch: renamed refs/heads/";
const RENAME_TARGET: &str = " to refs/heads/";
const REFLOG_CHUNK: u64 = 8192;
const MAX_CACHED_RENAMES: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitDirs {
    head_dir: PathBuf,
    common_dir: PathBuf,
}

fn resolve_from(base: &Path, value: &str) -> PathBuf {
    let path = Path::new(value.trim());
    if path.is_absolute() {
        return path.to_path_buf();
    }
    base.join(path)
}

fn dirs_of_dot_git(owner: &Path, dot_git: &Path) -> Option<GitDirs> {
    if dot_git.is_dir() {
        return Some(GitDirs {
            head_dir: dot_git.to_path_buf(),
            common_dir: dot_git.to_path_buf(),
        });
    }
    let text = std::fs::read_to_string(dot_git).ok()?;
    let pointer = text
        .lines()
        .find_map(|line| line.strip_prefix(GITDIR_LINE))?;
    let head_dir = resolve_from(owner, pointer);
    let common_dir = std::fs::read_to_string(head_dir.join("commondir"))
        .ok()
        .map(|value| resolve_from(&head_dir, &value))
        .unwrap_or_else(|| head_dir.clone());
    Some(GitDirs {
        head_dir,
        common_dir,
    })
}

fn git_dirs(path: &Path) -> Option<GitDirs> {
    path.ancestors().find_map(|dir| {
        let dot_git = dir.join(".git");
        if !dot_git.exists() {
            return None;
        }
        dirs_of_dot_git(dir, &dot_git)
    })
}

fn is_plain_branch_name(name: &str) -> bool {
    !name.is_empty()
        && !name.starts_with('/')
        && name
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}

pub(crate) fn branch_at(path: &Path) -> Option<String> {
    let dirs = git_dirs(path)?;
    let head = std::fs::read_to_string(dirs.head_dir.join("HEAD")).ok()?;
    let name = head.trim().strip_prefix(HEAD_REF)?.trim().to_string();
    if !is_plain_branch_name(&name) {
        return None;
    }
    Some(name)
}

fn has_ref(common_dir: &Path, name: &str) -> bool {
    if !is_plain_branch_name(name) {
        return false;
    }
    if common_dir.join("refs/heads").join(name).is_file() {
        return true;
    }
    let wanted = format!("refs/heads/{name}");
    std::fs::read_to_string(common_dir.join("packed-refs"))
        .map(|packed| {
            packed
                .lines()
                .filter(|line| !line.starts_with('#') && !line.starts_with('^'))
                .any(|line| line.split_whitespace().nth(1) == Some(wanted.as_str()))
        })
        .unwrap_or(false)
}

pub(crate) fn has_branch(path: &Path, name: &str) -> bool {
    git_dirs(path).is_some_and(|dirs| has_ref(&dirs.common_dir, name))
}

fn millis_of(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

fn touched_since(file: &Path, since_ms: u64) -> bool {
    std::fs::metadata(file)
        .and_then(|meta| meta.modified())
        .is_ok_and(|modified| millis_of(modified) >= since_ms)
}

fn reflog_files(dir: &Path, since_ms: u64, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            reflog_files(&path, since_ms, out);
            continue;
        }
        if touched_since(&path, since_ms) {
            out.push(path);
        }
    }
}

fn line_of(line: &str) -> Option<(u64, String)> {
    let (head, message) = line.split_once('\t')?;
    let mut fields = head.split_whitespace().rev();
    fields.next()?;
    let secs = fields.next()?.parse().ok()?;
    Some((secs, message.trim_end().to_string()))
}

fn is_after(secs: u64, since_ms: u64) -> bool {
    secs >= since_ms / 1000
}

fn first_line_secs(file: &mut std::fs::File) -> Option<u64> {
    file.seek(SeekFrom::Start(0)).ok()?;
    let mut first = String::new();
    BufReader::new(file).read_line(&mut first).ok()?;
    line_of(&first).map(|(secs, _)| secs)
}

fn complete_part(tail: &[u8], start: u64) -> &[u8] {
    if start == 0 {
        return tail;
    }
    tail.iter()
        .position(|byte| *byte == b'\n')
        .map_or(&tail[tail.len()..], |cut| &tail[cut + 1..])
}

fn tail_since(file: &mut std::fs::File, since_ms: u64) -> Vec<String> {
    let Ok(len) = file.seek(SeekFrom::End(0)) else {
        return Vec::new();
    };
    let mut tail: Vec<u8> = Vec::new();
    let mut start = len;
    while start > 0 {
        let from = start.saturating_sub(REFLOG_CHUNK);
        let mut chunk = vec![0; usize::try_from(start - from).unwrap_or(0)];
        if file.seek(SeekFrom::Start(from)).is_err() || file.read_exact(&mut chunk).is_err() {
            return Vec::new();
        }
        chunk.extend_from_slice(&tail);
        tail = chunk;
        start = from;
        let earliest = String::from_utf8_lossy(complete_part(&tail, start))
            .lines()
            .find_map(line_of)
            .map(|(secs, _)| secs);
        if earliest.is_some_and(|secs| !is_after(secs, since_ms)) {
            break;
        }
    }
    String::from_utf8_lossy(complete_part(&tail, start))
        .lines()
        .map(str::to_string)
        .collect()
}

fn lines_since(file: &mut std::fs::File, since_ms: u64) -> Vec<(u64, String)> {
    tail_since(file, since_ms)
        .iter()
        .filter_map(|line| line_of(line))
        .filter(|(secs, _)| is_after(*secs, since_ms))
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct ReflogMark {
    line: String,
    secs: u64,
    occurrence: usize,
}

fn nth_match(tail: &[String], mark: &ReflogMark) -> Option<usize> {
    tail.iter()
        .enumerate()
        .filter(|(_, line)| **line == mark.line)
        .nth(mark.occurrence.checked_sub(1)?)
        .map(|(at, _)| at)
}

fn entries_after(
    file: &mut std::fs::File,
    since_ms: u64,
    mark: Option<&ReflogMark>,
) -> Vec<(u64, String)> {
    let Some(mark) = mark else {
        return lines_since(file, since_ms);
    };
    let tail = tail_since(file, mark.secs.saturating_mul(1000));
    let Some(at) = nth_match(&tail, mark) else {
        return Vec::new();
    };
    tail[at + 1..]
        .iter()
        .filter_map(|line| line_of(line))
        .collect()
}

fn rename_of(message: &str) -> Option<(String, String)> {
    let (from, to) = message
        .strip_prefix(RENAME_MESSAGE)?
        .split_once(RENAME_TARGET)?;
    if !is_plain_branch_name(from) || !is_plain_branch_name(to) {
        return None;
    }
    Some((from.to_string(), to.to_string()))
}

fn lineage_end(
    file: &Path,
    name: &str,
    since_ms: u64,
    mark: Option<&ReflogMark>,
) -> Option<String> {
    let mut handle = std::fs::File::open(file).ok()?;
    let is_recreated_later =
        first_line_secs(&mut handle).is_some_and(|secs| secs.saturating_mul(1000) > since_ms);
    if is_recreated_later {
        return None;
    }
    let mut current = name.to_string();
    let mut has_moved = false;
    for (from, to) in entries_after(&mut handle, since_ms, mark)
        .iter()
        .filter_map(|(_, message)| rename_of(message))
    {
        if from != current {
            continue;
        }
        current = to;
        has_moved = true;
    }
    has_moved.then_some(current)
}

fn ref_name_of(logs: &Path, file: &Path) -> Option<String> {
    let parts: Option<Vec<&str>> = file
        .strip_prefix(logs)
        .ok()?
        .components()
        .map(|part| part.as_os_str().to_str())
        .collect();
    Some(parts?.join("/"))
}

fn follow_renames(
    common_dir: &Path,
    name: &str,
    since_ms: u64,
    mark: Option<&ReflogMark>,
) -> Option<String> {
    let logs = common_dir.join("logs/refs/heads");
    let mut files = Vec::new();
    reflog_files(&logs, since_ms, &mut files);
    let targets: Vec<String> = files
        .iter()
        .filter_map(|file| {
            let end = lineage_end(file, name, since_ms, mark)?;
            (ref_name_of(&logs, file)? == end).then_some(end)
        })
        .collect();
    let [target] = targets.as_slice() else {
        return None;
    };
    has_ref(common_dir, target).then(|| target.clone())
}

pub(crate) fn reflog_mark(path: &Path, name: &str) -> Option<ReflogMark> {
    if !is_plain_branch_name(name) {
        return None;
    }
    let dirs = git_dirs(path)?;
    let mut handle =
        std::fs::File::open(dirs.common_dir.join("logs/refs/heads").join(name)).ok()?;
    let line = tail_since(&mut handle, u64::MAX).pop()?;
    let (secs, _) = line_of(&line)?;
    let occurrence = tail_since(&mut handle, secs.saturating_mul(1000))
        .iter()
        .filter(|seen| **seen == line)
        .count();
    Some(ReflogMark {
        line,
        secs,
        occurrence,
    })
}

type RefStamp = Vec<(PathBuf, u64)>;

fn stamp_dirs(dir: &Path, out: &mut RefStamp) {
    let Ok(meta) = std::fs::metadata(dir) else {
        return;
    };
    out.push((dir.to_path_buf(), meta.modified().map_or(0, nanos_of)));
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            stamp_dirs(&entry.path(), out);
        }
    }
}

fn nanos_of(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_nanos()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

fn ref_stamp(common_dir: &Path) -> RefStamp {
    let mut stamp = RefStamp::new();
    stamp_dirs(&common_dir.join("logs/refs/heads"), &mut stamp);
    stamp_dirs(&common_dir.join("refs/heads"), &mut stamp);
    let packed = common_dir.join("packed-refs");
    if let Ok(modified) = std::fs::metadata(&packed).and_then(|meta| meta.modified()) {
        stamp.push((packed, nanos_of(modified)));
    }
    stamp
}

type RenameKey = (PathBuf, String, u64, Option<ReflogMark>);
type RenameCache = HashMap<RenameKey, (RefStamp, Option<String>)>;

fn rename_cache() -> &'static Mutex<RenameCache> {
    static CACHE: OnceLock<Mutex<RenameCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(RenameCache::new()))
}

fn cached(key: &RenameKey, stamp: &RefStamp) -> Option<Option<String>> {
    let cache = rename_cache().lock().ok()?;
    cache
        .get(key)
        .filter(|(seen, _)| seen == stamp)
        .map(|(_, target)| target.clone())
}

fn remember(key: RenameKey, stamp: RefStamp, target: Option<String>) {
    let Ok(mut cache) = rename_cache().lock() else {
        return;
    };
    if cache.len() >= MAX_CACHED_RENAMES {
        cache.clear();
    }
    cache.insert(key, (stamp, target));
}

fn rename_key(
    common_dir: &Path,
    name: &str,
    since_ms: u64,
    mark: Option<&ReflogMark>,
) -> RenameKey {
    (
        common_dir.to_path_buf(),
        name.to_string(),
        since_ms,
        mark.cloned(),
    )
}

pub(crate) fn renamed_to(
    path: &Path,
    name: &str,
    since_ms: u64,
    mark: Option<&ReflogMark>,
) -> Option<String> {
    let dirs = git_dirs(path)?;
    let key = rename_key(&dirs.common_dir, name, since_ms, mark);
    let stamp = ref_stamp(&dirs.common_dir);
    if let Some(target) = cached(&key, &stamp) {
        return target;
    }
    let target = follow_renames(&dirs.common_dir, name, since_ms, mark);
    remember(key, stamp, target.clone());
    target
}

#[cfg(test)]
pub(crate) fn is_cached(path: &Path, name: &str, since_ms: u64) -> bool {
    let Some(dirs) = git_dirs(path) else {
        return false;
    };
    let key = rename_key(&dirs.common_dir, name, since_ms, None);
    cached(&key, &ref_stamp(&dirs.common_dir)).is_some()
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::path::{Path, PathBuf};

    pub(crate) fn write(path: &Path, text: &str) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("parent dir");
        }
        std::fs::write(path, text).expect("write file");
    }

    pub(crate) fn repo_on(root: &Path, branch: &str) -> PathBuf {
        let git = root.join(".git");
        write(&git.join("HEAD"), &format!("ref: refs/heads/{branch}\n"));
        write(
            &git.join("refs/heads").join(branch),
            "0000000000000000000000000000000000000000\n",
        );
        root.to_path_buf()
    }

    pub(crate) fn switch_to(root: &Path, branch: &str) {
        let git = root.join(".git");
        write(
            &git.join("refs/heads").join(branch),
            "0000000000000000000000000000000000000000\n",
        );
        write(&git.join("HEAD"), &format!("ref: refs/heads/{branch}\n"));
    }

    pub(crate) const EPOCH_SECS: u64 = 1_700_000_000;

    pub(crate) fn millis_at(secs: u64) -> u64 {
        secs * 1000
    }

    pub(crate) fn git_at(root: &Path, secs: u64, args: &[&str]) {
        let output = std::process::Command::new("git")
            .arg("-C")
            .arg(root)
            .args(["-c", "user.name=Acme", "-c", "user.email=dev@acme.test"])
            .args(["-c", "core.logAllRefUpdates=true"])
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_COMMITTER_DATE", format!("@{secs} +0000"))
            .env("GIT_AUTHOR_DATE", format!("@{secs} +0000"))
            .output()
            .expect("run git");
        assert!(
            output.status.success(),
            "git {args:?}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    pub(crate) fn git_repo_on(root: &Path, branch: &str) -> PathBuf {
        std::fs::create_dir_all(root).expect("repo dir");
        git_at(root, EPOCH_SECS, &["init", "-q", "-b", "main"]);
        git_at(
            root,
            EPOCH_SECS,
            &["commit", "-q", "--allow-empty", "-m", "init"],
        );
        if branch != "main" {
            git_at(root, EPOCH_SECS, &["switch", "-q", "-c", branch]);
        }
        root.to_path_buf()
    }
}

#[cfg(test)]
mod tests {
    use super::test_support::{git_at, git_repo_on, millis_at, repo_on, write, EPOCH_SECS};
    use super::*;

    fn scratch(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "goodboy-git-head-{label}-{:016x}",
            rand::random::<u64>()
        ));
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    #[test]
    fn a_rename_in_the_same_second_as_the_start_counts() {
        assert!(is_after(1_700_000_050, 1_700_000_050_123));
        assert!(!is_after(1_700_000_049, 1_700_000_050_123));
    }

    #[test]
    fn a_plain_checkout_reads_its_branch_from_any_subfolder() {
        let root = repo_on(&scratch("plain"), "nw/fix-duplicate-credit");
        std::fs::create_dir_all(root.join("src/api")).expect("subfolder");
        assert_eq!(
            branch_at(&root.join("src/api")).as_deref(),
            Some("nw/fix-duplicate-credit")
        );
        assert!(has_branch(&root, "nw/fix-duplicate-credit"));
        assert!(!has_branch(&root, "main"));
    }

    #[test]
    fn a_linked_worktree_reads_head_from_its_gitdir_and_refs_from_the_common_dir() {
        let base = scratch("linked");
        let main = repo_on(&base.join("payments-api"), "main");
        let admin = main.join(".git/worktrees/fix");
        write(&admin.join("HEAD"), "ref: refs/heads/nw/ledger-rounding\n");
        write(&admin.join("commondir"), "../..\n");
        write(
            &main.join(".git/refs/heads/nw/ledger-rounding"),
            "0000000000000000000000000000000000000000\n",
        );
        let linked = base.join("fix");
        write(
            &linked.join(".git"),
            &format!("gitdir: {}\n", admin.to_string_lossy()),
        );
        assert_eq!(branch_at(&linked).as_deref(), Some("nw/ledger-rounding"));
        assert!(has_branch(&linked, "nw/ledger-rounding"));
        assert!(has_branch(&linked, "main"));
    }

    #[test]
    fn a_packed_ref_counts_as_a_branch() {
        let root = repo_on(&scratch("packed"), "main");
        write(
            &root.join(".git/packed-refs"),
            "# pack-refs with: peeled fully-peeled sorted\n0000000000000000000000000000000000000000 refs/heads/notify-relay\n",
        );
        assert!(has_branch(&root, "notify-relay"));
    }

    #[test]
    fn a_detached_head_or_a_folder_outside_git_has_no_branch() {
        let root = scratch("detached");
        write(
            &root.join(".git/HEAD"),
            "0000000000000000000000000000000000000000\n",
        );
        assert_eq!(branch_at(&root), None);
        let loose = scratch("loose");
        assert_eq!(branch_at(&loose), None);
        assert!(!has_branch(&loose, "main"));
    }

    const STARTED: u64 = EPOCH_SECS + 50;

    #[test]
    fn a_rename_is_followed_only_through_the_reflog() {
        let root = git_repo_on(&scratch("renames"), "nw/credit");
        let since = millis_at(STARTED);
        let mark = reflog_mark(&root, "nw/credit");
        assert!(mark.is_some());
        assert_eq!(renamed_to(&root, "nw/credit", since, mark.as_ref()), None);
        git_at(
            &root,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        assert_eq!(
            renamed_to(&root, "nw/credit", since, mark.as_ref()).as_deref(),
            Some("nw/credit-fix")
        );
        git_at(
            &root,
            STARTED + 20,
            &["branch", "-m", "nw/credit-fix", "nw/credit-final"],
        );
        assert_eq!(
            renamed_to(&root, "nw/credit", since, mark.as_ref()).as_deref(),
            Some("nw/credit-final")
        );
        assert_eq!(
            renamed_to(&root, "nw/credit-fix", since, mark.as_ref()).as_deref(),
            Some("nw/credit-final")
        );
        assert_eq!(
            renamed_to(&root, "nw/credit", since, None).as_deref(),
            Some("nw/credit-final")
        );
        assert_eq!(renamed_to(&root, "nw/rounding", since, None), None);
    }

    #[test]
    fn a_name_recreated_inside_a_rename_chain_is_not_its_branch() {
        let root = git_repo_on(&scratch("chain-recreated"), "nw/credit");
        let since = millis_at(STARTED);
        let mark = reflog_mark(&root, "nw/credit");
        git_at(
            &root,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        git_at(
            &root,
            STARTED + 20,
            &["branch", "-m", "nw/credit-fix", "nw/credit-final"],
        );
        git_at(&root, STARTED + 30, &["branch", "nw/credit-fix"]);
        assert!(has_branch(&root, "nw/credit-fix"));
        assert_eq!(
            renamed_to(&root, "nw/credit", since, mark.as_ref()).as_deref(),
            Some("nw/credit-final")
        );
        assert_eq!(
            renamed_to(&root, "nw/credit", since, None).as_deref(),
            Some("nw/credit-final")
        );
    }

    #[test]
    fn a_name_recreated_and_renamed_in_the_start_second_keeps_the_first_lineage() {
        let root = git_repo_on(&scratch("same-second"), "nw/credit");
        let since = millis_at(STARTED) + 400;
        let mark = reflog_mark(&root, "nw/credit");
        git_at(
            &root,
            STARTED,
            &["branch", "-m", "nw/credit", "nw/credit-a"],
        );
        git_at(&root, STARTED, &["branch", "nw/credit"]);
        git_at(
            &root,
            STARTED,
            &["branch", "-m", "nw/credit", "nw/credit-b"],
        );
        assert_eq!(renamed_to(&root, "nw/credit", since, None), None);
        assert_eq!(
            renamed_to(&root, "nw/credit", since, mark.as_ref()).as_deref(),
            Some("nw/credit-a")
        );
    }

    #[test]
    fn an_identical_entry_after_the_rename_does_not_move_the_spawn_cursor() {
        let root = git_repo_on(&scratch("identical-entries"), "nw/credit");
        let since = millis_at(STARTED) + 400;
        let logs = root.join(".git/logs/refs/heads");
        let reset = format!(
            "{zero} {zero} Acme <dev@acme.test> {STARTED} +0000\treset: moving to HEAD\n",
            zero = "0".repeat(40)
        );
        let append = |name: &str| {
            let file = logs.join(name);
            let mut text = std::fs::read_to_string(&file).expect("reflog");
            text.push_str(&reset);
            write(&file, &text);
        };
        append("nw/credit");
        let mark = reflog_mark(&root, "nw/credit");
        git_at(
            &root,
            STARTED,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        append("nw/credit-fix");
        let reflog = std::fs::read_to_string(logs.join("nw/credit-fix")).expect("reflog");
        let lines: Vec<&str> = reflog.lines().collect();
        assert_eq!(lines.last(), lines.iter().rev().nth(2));
        assert_eq!(
            renamed_to(&root, "nw/credit", since, mark.as_ref()).as_deref(),
            Some("nw/credit-fix")
        );
    }

    #[test]
    fn a_rename_older_than_the_process_is_not_followed() {
        let root = git_repo_on(&scratch("older-rename"), "nw/credit");
        git_at(
            &root,
            STARTED - 30,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        git_at(&root, STARTED - 20, &["branch", "nw/credit"]);
        git_at(&root, STARTED + 10, &["branch", "-D", "nw/credit"]);
        assert!(!has_branch(&root, "nw/credit"));
        assert!(has_branch(&root, "nw/credit-fix"));
        assert_eq!(
            renamed_to(&root, "nw/credit", millis_at(STARTED), None),
            None
        );
        assert_eq!(
            renamed_to(&root, "nw/credit", millis_at(STARTED - 40), None).as_deref(),
            Some("nw/credit-fix")
        );
    }

    #[test]
    fn a_name_recreated_after_the_process_started_is_not_its_branch() {
        let root = git_repo_on(&scratch("recreated"), "nw/credit");
        git_at(
            &root,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-a"],
        );
        git_at(&root, STARTED + 20, &["branch", "nw/credit"]);
        git_at(
            &root,
            STARTED + 30,
            &["branch", "-m", "nw/credit", "nw/credit-b"],
        );
        assert_eq!(
            renamed_to(&root, "nw/credit", millis_at(STARTED), None).as_deref(),
            Some("nw/credit-a")
        );
    }

    #[test]
    fn a_rename_that_ends_in_a_deleted_branch_is_not_followed() {
        let root = git_repo_on(&scratch("renamed-deleted"), "nw/credit");
        git_at(
            &root,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        git_at(&root, STARTED + 20, &["switch", "-q", "main"]);
        git_at(&root, STARTED + 30, &["branch", "-D", "nw/credit-fix"]);
        assert_eq!(
            renamed_to(&root, "nw/credit", millis_at(STARTED), None),
            None
        );
    }

    #[test]
    fn a_resolution_is_kept_until_the_refs_change() {
        let root = git_repo_on(&scratch("cached"), "nw/credit");
        let since = millis_at(STARTED);
        git_at(&root, STARTED + 10, &["switch", "-q", "main"]);
        git_at(&root, STARTED + 20, &["branch", "-D", "nw/credit"]);
        assert!(!is_cached(&root, "nw/credit", since));
        assert_eq!(renamed_to(&root, "nw/credit", since, None), None);
        assert!(is_cached(&root, "nw/credit", since));
        git_at(&root, STARTED + 30, &["branch", "nw/rounding"]);
        assert!(!is_cached(&root, "nw/credit", since));
    }

    #[test]
    fn a_long_reflog_is_read_only_back_to_the_process_start() {
        let root = git_repo_on(&scratch("long"), "nw/credit");
        let file = root.join(".git/logs/refs/heads/nw/credit");
        let old_line = format!(
            "{zero} {zero} Acme <dev@acme.test> {EPOCH_SECS} +0000\tcommit: old\n",
            zero = "0".repeat(40)
        );
        let mut text = std::fs::read_to_string(&file).expect("reflog");
        text.push_str(&old_line.repeat(2000));
        write(&file, &text);
        git_at(
            &root,
            STARTED + 10,
            &["branch", "-m", "nw/credit", "nw/credit-fix"],
        );
        let mut handle =
            std::fs::File::open(root.join(".git/logs/refs/heads/nw/credit-fix")).expect("open");
        let recent = lines_since(&mut handle, millis_at(STARTED));
        assert_eq!(recent.len(), 1);
        assert!(recent[0].1.starts_with(RENAME_MESSAGE));
        assert_eq!(
            renamed_to(&root, "nw/credit", millis_at(STARTED), None).as_deref(),
            Some("nw/credit-fix")
        );
    }

    #[test]
    fn a_name_that_climbs_out_of_refs_is_never_a_branch() {
        let root = repo_on(&scratch("climb"), "main");
        assert!(!has_branch(&root, "../HEAD"));
        assert!(!has_branch(&root, ""));
    }
}

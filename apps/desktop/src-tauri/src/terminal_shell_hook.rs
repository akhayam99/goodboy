use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const USER_DIR_ENV: &str = "GOODBOY_USER_ZDOTDIR";
const STARTUP_FILES: [&str; 4] = [".zshenv", ".zprofile", ".zshrc", ".zlogin"];

const EXIT_HOOK: &str = r#"
__goodboy_preexec() {
  emulate -L zsh
  __goodboy_ran=1
  __goodboy_command=${1:-${2-}}
}
__goodboy_precmd() {
  local __goodboy_code=$?
  emulate -L zsh
  setopt hist_subst_pattern
  if [[ $__goodboy_ran == 1 ]]; then
    local __goodboy_line=${__goodboy_command:gs/[[:cntrl:]]/ }
    builtin printf '\033]633;D;%s;%s\007' "$__goodboy_code" "${__goodboy_line[1,200]}"
  fi
  __goodboy_ran=0
  __goodboy_command=
}
() {
  emulate -L zsh
  typeset -g __goodboy_ran=0 __goodboy_command=
  typeset -ga precmd_functions preexec_functions
  precmd_functions=(__goodboy_precmd ${precmd_functions:#__goodboy_precmd})
  preexec_functions=(${preexec_functions:#__goodboy_preexec} __goodboy_preexec)
}
"#;

const HAND_BACK: &str = r#"
ZDOTDIR="$GOODBOY_USER_ZDOTDIR"
unset GOODBOY_USER_ZDOTDIR __goodboy_zdotdir
"#;

fn source_user_file(name: &str) -> String {
    format!(
        r#"__goodboy_zdotdir="$ZDOTDIR"
ZDOTDIR="$GOODBOY_USER_ZDOTDIR"
if [[ -f "$ZDOTDIR/{name}" ]]; then
  builtin source "$ZDOTDIR/{name}"
fi
GOODBOY_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$__goodboy_zdotdir"
"#
    )
}

fn startup_file(name: &str) -> String {
    let mut text = source_user_file(name);
    if name == ".zshrc" {
        text.push_str(EXIT_HOOK);
    }
    if name == ".zlogin" {
        text.push_str(HAND_BACK);
    }
    text
}

pub(crate) fn is_on(setting: Option<&str>) -> bool {
    setting.map(str::trim) != Some("false")
}

fn is_zsh(shell: &str) -> bool {
    Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name == "zsh")
}

static TEMP_SEQ: AtomicU64 = AtomicU64::new(0);

fn write_if_changed(path: &Path, text: &str) -> std::io::Result<()> {
    if std::fs::read_to_string(path).is_ok_and(|current| current == text) {
        return Ok(());
    }
    let temp = path.with_extension(format!(
        "tmp-{}-{}",
        std::process::id(),
        TEMP_SEQ.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::write(&temp, text)?;
    if let Err(error) = std::fs::rename(&temp, path) {
        let _ = std::fs::remove_file(&temp);
        return Err(error);
    }
    Ok(())
}

fn write_zsh_files(dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    for name in STARTUP_FILES {
        write_if_changed(&dir.join(name), &startup_file(name))?;
    }
    Ok(())
}

pub(crate) fn hook_env(
    shell: &str,
    base: &Path,
    user_dir: Option<String>,
    home: Option<String>,
) -> Option<Vec<(String, String)>> {
    if !is_zsh(shell) {
        return None;
    }
    let dir: PathBuf = base.join("zsh");
    if let Err(error) = write_zsh_files(&dir) {
        log::warn!("[terminal] shell hook not written: {error}");
        return None;
    }
    let user = user_dir.or(home)?;
    Some(vec![
        (USER_DIR_ENV.to_string(), user),
        ("ZDOTDIR".to_string(), dir.to_string_lossy().into_owned()),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("goodboy-shell-hook-{:016x}", rand::random::<u64>()));
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    #[test]
    fn zsh_gets_startup_files_in_the_app_folder_that_source_the_user_ones() {
        let base = scratch();
        let env = hook_env("/bin/zsh", &base, None, Some("/mock/home/acme".to_string()))
            .expect("zsh is hooked");
        assert_eq!(
            env,
            vec![
                (USER_DIR_ENV.to_string(), "/mock/home/acme".to_string()),
                (
                    "ZDOTDIR".to_string(),
                    base.join("zsh").to_string_lossy().into_owned()
                ),
            ]
        );
        for name in STARTUP_FILES {
            let text = std::fs::read_to_string(base.join("zsh").join(name)).expect("file");
            assert!(text.contains(&format!("builtin source \"$ZDOTDIR/{name}\"")));
        }
        let rc = std::fs::read_to_string(base.join("zsh/.zshrc")).expect("zshrc");
        assert!(rc.contains("633;D;"));
        let login = std::fs::read_to_string(base.join("zsh/.zlogin")).expect("zlogin");
        assert!(login.contains("unset GOODBOY_USER_ZDOTDIR"));
    }

    #[cfg(unix)]
    #[test]
    fn a_second_spawn_leaves_matching_startup_files_untouched() {
        use std::os::unix::fs::MetadataExt as _;
        let base = scratch();
        hook_env("/bin/zsh", &base, None, Some("/mock/home/acme".to_string())).expect("first");
        let before: Vec<u64> = STARTUP_FILES
            .iter()
            .map(|name| std::fs::metadata(base.join("zsh").join(name)).expect("meta").ino())
            .collect();
        hook_env("/bin/zsh", &base, None, Some("/mock/home/acme".to_string())).expect("second");
        let after: Vec<u64> = STARTUP_FILES
            .iter()
            .map(|name| std::fs::metadata(base.join("zsh").join(name)).expect("meta").ino())
            .collect();
        assert_eq!(before, after);
    }

    #[test]
    fn a_stale_startup_file_is_replaced_whole_and_leaves_no_temp_file() {
        let base = scratch();
        let dir = base.join("zsh");
        std::fs::create_dir_all(&dir).expect("dir");
        std::fs::write(dir.join(".zshrc"), "stale").expect("stale");
        hook_env("/bin/zsh", &base, None, Some("/mock/home/acme".to_string())).expect("hooked");
        let rc = std::fs::read_to_string(dir.join(".zshrc")).expect("zshrc");
        assert_eq!(rc, startup_file(".zshrc"));
        let names: Vec<String> = std::fs::read_dir(&dir)
            .expect("read dir")
            .map(|entry| entry.expect("entry").file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names.len(), STARTUP_FILES.len(), "got {names:?}");
    }

    #[test]
    fn the_hook_is_on_unless_the_setting_turns_it_off() {
        assert!(is_on(None));
        assert!(is_on(Some("true")));
        assert!(!is_on(Some("false")));
    }

    #[test]
    fn a_custom_zdotdir_is_kept_as_the_user_folder() {
        let env = hook_env(
            "zsh",
            &scratch(),
            Some("/mock/home/acme/.config/zsh".to_string()),
            Some("/mock/home/acme".to_string()),
        )
        .expect("zsh is hooked");
        assert_eq!(env[0].1, "/mock/home/acme/.config/zsh");
    }

    #[test]
    fn other_shells_are_left_alone() {
        assert_eq!(
            hook_env("/bin/bash", &scratch(), None, Some("/h".to_string())),
            None
        );
        assert_eq!(
            hook_env(
                "/opt/homebrew/bin/fish",
                &scratch(),
                None,
                Some("/h".to_string())
            ),
            None
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_real_zsh_marks_the_exit_status_of_a_command() {
        if !Path::new("/bin/zsh").exists() {
            return;
        }
        let base = scratch();
        let home = scratch();
        let env = hook_env(
            "/bin/zsh",
            &base,
            None,
            Some(home.to_string_lossy().into_owned()),
        )
        .expect("zsh is hooked");
        let output = std::process::Command::new("/bin/zsh")
            .arg("-i")
            .arg("-c")
            .arg("__goodboy_ran=1; false; __goodboy_precmd")
            .env_clear()
            .env("HOME", &home)
            .envs(env)
            .output()
            .expect("run zsh");
        let text = String::from_utf8_lossy(&output.stdout);
        assert!(text.contains("\x1b]633;D;1;\x07"), "got {text:?}");
    }

    #[cfg(unix)]
    #[test]
    fn a_real_zsh_with_nounset_and_a_user_hook_reports_each_command() {
        if !Path::new("/bin/zsh").exists() {
            return;
        }
        let base = scratch();
        let home = scratch();
        std::fs::write(
            home.join(".zshrc"),
            "setopt nounset no_prompt_sp no_prompt_cr\nPS1=''\nPS2=''\n__acme_precmd() { builtin print -r -- acme-hook-ran }\nprecmd_functions+=(__acme_precmd)\n",
        )
        .expect("user zshrc");
        let env = hook_env(
            "/bin/zsh",
            &base,
            None,
            Some(home.to_string_lossy().into_owned()),
        )
        .expect("zsh is hooked");
        let mut child = std::process::Command::new("/bin/zsh")
            .arg("-i")
            .env_clear()
            .env("HOME", &home)
            .envs(env)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .expect("run zsh");
        {
            use std::io::Write as _;
            let stdin = child.stdin.as_mut().expect("stdin");
            stdin
                .write_all(b"true\nfalse\nif true\nthen true\nfi\nexit\n")
                .expect("write commands");
        }
        let output = child.wait_with_output().expect("zsh output");
        let text = String::from_utf8_lossy(&output.stdout);
        let errors = String::from_utf8_lossy(&output.stderr);
        assert_eq!(errors, "", "stdout {text:?}");
        assert!(text.contains("\x1b]633;D;0;true\x07"), "got {text:?}");
        assert!(text.contains("\x1b]633;D;1;false\x07"), "got {text:?}");
        assert!(
            text.contains("\x1b]633;D;0;if true then true fi\x07"),
            "got {text:?}"
        );
        assert!(text.contains("acme-hook-ran"), "got {text:?}");
        assert_eq!(text.matches("\x1b]633;D;").count(), 3, "got {text:?}");
    }
}

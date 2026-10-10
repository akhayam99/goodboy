fake_dir=$(cd "$(dirname "$0")" && pwd)
fake_mode=ok
if [ -f "$fake_dir/mode" ]; then
  fake_mode=$(cat "$fake_dir/mode")
fi

fake_record() {
  printf '%s\n' "$@" > "$PWD/fake-cli-argv.txt"
  {
    printf 'cwd=%s\n' "$PWD"
    for key in GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 GIT_CONFIG_KEY_1 GIT_CONFIG_VALUE_1 GH_TOKEN GITHUB_TOKEN CLAUDECODE CURSOR_CONFIG_DIR; do
      eval "value=\${$key-__unset__}"
      printf '%s=%s\n' "$key" "$value"
    done
  } > "$PWD/fake-cli-env.txt"
}

fake_flood_stderr() {
  dd if=/dev/zero bs=1024 count=300 2>/dev/null | tr '\0' 'e' >&2
  printf '\nflood-tail-marker\n' >&2
}

fake_turn() {
  stream=$1
  shift
  fake_record "$@"
  case "$fake_mode" in
    ok)
      cat "$fake_dir/streams/$stream"
      ;;
    fail)
      head -n 2 "$fake_dir/streams/$stream"
      printf 'fake cli: authentication failed\n' >&2
      exit 3
      ;;
    flood)
      fake_flood_stderr
      cat "$fake_dir/streams/$stream"
      ;;
    partial)
      cat "$fake_dir/streams/$stream"
      printf 'unterminated final line'
      ;;
    binary)
      printf 'caf\351\n'
      ;;
    silent)
      ;;
    hang)
      head -n 1 "$fake_dir/streams/$stream"
      sleep 30 &
      printf '%s\n' "$!" > "$PWD/fake-cli-sleeper.pid"
      wait
      ;;
    exit-leaving-child)
      head -n 1 "$fake_dir/streams/$stream"
      fake_helper >/dev/null 2>&1 </dev/null &
      printf '%s\n' "$!" > "$PWD/fake-cli-sleeper.pid"
      sleep 0.5
      ;;
    own-session-child | own-session-hang)
      head -n 1 "$fake_dir/streams/$stream"
      fake_helper_own_session >/dev/null 2>&1 </dev/null &
      printf '%s\n' "$!" > "$PWD/fake-cli-sleeper.pid"
      sleep 0.5
      if [ "$fake_mode" = own-session-hang ]; then
        sleep 30
      fi
      ;;
    holds-stdout)
      head -n 1 "$fake_dir/streams/$stream"
      fake_helper &
      printf '%s\n' "$!" > "$PWD/fake-cli-sleeper.pid"
      sleep 0.5
      ;;
  esac
}

fake_helper() {
  GOODBOY_REAP_HELPER=1 exec "$GOODBOY_REAP_HELPER_EXE" --exact "$GOODBOY_REAP_HELPER_TEST" --nocapture --test-threads=1
}

fake_helper_own_session() {
  GOODBOY_REAP_HELPER=1 exec perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' -- "$GOODBOY_REAP_HELPER_EXE" --exact "$GOODBOY_REAP_HELPER_TEST" --nocapture --test-threads=1
}

fake_hang() {
  printf '%s\n' "$$" >> "$fake_dir/probe.pid"
  exec sleep 30
}

fake_version() {
  case "$fake_mode" in
    version-fail)
      printf 'fake cli: cannot start\n' >&2
      exit 1
      ;;
    version-hang | slow)
      fake_hang
      ;;
    *)
      printf '%s\n' "$1"
      ;;
  esac
}

fake_usage_error() {
  printf "error: unrecognized subcommand '%s'\n" "$1" >&2
  exit 2
}

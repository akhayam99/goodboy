const PREFIX: &[u8] = b"\x1b]633;D;";
const BEL: u8 = 0x07;
const ESC: u8 = 0x1b;
const SEPARATOR: u8 = b';';
const MAX_CODE_LEN: usize = 12;
const MAX_PAYLOAD_LEN: usize = MAX_CODE_LEN + 1 + 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ExitMark {
    pub(crate) code: i32,
    pub(crate) command: Option<String>,
}

#[derive(Default)]
pub(crate) struct ExitMarks {
    carry: Vec<u8>,
}

enum Mark {
    Code(ExitMark, usize),
    Partial,
    Invalid,
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn command_of(bytes: &[u8]) -> Option<String> {
    std::str::from_utf8(bytes)
        .ok()
        .map(str::trim)
        .filter(|text| !text.is_empty() && !text.chars().any(char::is_control))
        .map(str::to_string)
}

fn parse_payload(payload: &[u8]) -> Option<ExitMark> {
    let split = payload.iter().position(|byte| *byte == SEPARATOR);
    let code_bytes = &payload[..split.unwrap_or(payload.len())];
    let is_code = !code_bytes.is_empty()
        && code_bytes.len() <= MAX_CODE_LEN
        && code_bytes
            .iter()
            .all(|byte| byte.is_ascii_digit() || *byte == b'-');
    if !is_code {
        return None;
    }
    let code = std::str::from_utf8(code_bytes).ok()?.parse::<i32>().ok()?;
    let command = split.and_then(|at| command_of(&payload[at + 1..]));
    Some(ExitMark { code, command })
}

fn read_mark(data: &[u8], start: usize) -> Mark {
    let mut end = start;
    while end < data.len() {
        let byte = data[end];
        let is_terminator = byte == BEL || (byte == ESC && data.get(end + 1) == Some(&b'\\'));
        if is_terminator {
            let width = 1 + usize::from(byte == ESC);
            return parse_payload(&data[start..end])
                .map_or(Mark::Invalid, |mark| Mark::Code(mark, end + width));
        }
        if byte == ESC && end + 1 == data.len() {
            return Mark::Partial;
        }
        if byte == ESC || end - start >= MAX_PAYLOAD_LEN {
            return Mark::Invalid;
        }
        end += 1;
    }
    Mark::Partial
}

impl ExitMarks {
    pub(crate) fn feed(&mut self, bytes: &[u8]) -> Option<ExitMark> {
        if self.carry.is_empty() && !bytes.contains(&ESC) {
            return None;
        }
        let mut data = std::mem::take(&mut self.carry);
        data.extend_from_slice(bytes);
        let mut last = None;
        let mut from = 0;
        loop {
            let Some(offset) = find(&data[from..], PREFIX) else {
                let keep = data.len().saturating_sub(from).min(PREFIX.len() - 1);
                self.carry = data[data.len() - keep..].to_vec();
                return last;
            };
            let at = from + offset;
            match read_mark(&data, at + PREFIX.len()) {
                Mark::Code(mark, next) => {
                    last = Some(mark);
                    from = next;
                }
                Mark::Partial => {
                    self.carry = data[at..].to_vec();
                    return last;
                }
                Mark::Invalid => from = at + PREFIX.len(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn code(code: i32) -> Option<ExitMark> {
        Some(ExitMark {
            code,
            command: None,
        })
    }

    fn ran(code: i32, command: &str) -> Option<ExitMark> {
        Some(ExitMark {
            code,
            command: Some(command.to_string()),
        })
    }

    #[test]
    fn a_mark_ended_by_bel_reads_its_exit_code() {
        let mut marks = ExitMarks::default();
        assert_eq!(marks.feed(b"pnpm test\r\n\x1b]633;D;1\x07% "), code(1));
    }

    #[test]
    fn a_mark_ended_by_st_reads_its_exit_code() {
        let mut marks = ExitMarks::default();
        assert_eq!(marks.feed(b"\x1b]633;D;0\x1b\\"), code(0));
    }

    #[test]
    fn a_mark_carries_the_command_the_shell_ran() {
        let mut marks = ExitMarks::default();
        assert_eq!(
            marks.feed(b"\x1b]633;D;0;pnpm --filter ledger-core test; echo ok\x07% "),
            ran(0, "pnpm --filter ledger-core test; echo ok")
        );
        assert_eq!(marks.feed(b"\x1b]633;D;130;\x07"), code(130));
    }

    #[test]
    fn the_last_mark_in_a_chunk_wins() {
        let mut marks = ExitMarks::default();
        assert_eq!(
            marks.feed(b"\x1b]633;D;1;false\x07ok\r\n\x1b]633;D;0;true\x07"),
            ran(0, "true")
        );
    }

    #[test]
    fn a_mark_split_across_reads_is_joined() {
        let mut marks = ExitMarks::default();
        assert_eq!(marks.feed(b"done\r\n\x1b]63"), None);
        assert_eq!(marks.feed(b"3;D;12"), None);
        assert_eq!(marks.feed(b"7;pnpm de"), None);
        assert_eq!(marks.feed(b"v\x07% "), ran(127, "pnpm dev"));
    }

    #[test]
    fn a_terminator_split_across_reads_is_joined() {
        let mut marks = ExitMarks::default();
        assert_eq!(marks.feed(b"\x1b]633;D;2\x1b"), None);
        assert_eq!(marks.feed(b"\\"), code(2));
    }

    #[test]
    fn plain_output_and_other_escapes_carry_no_mark() {
        let mut marks = ExitMarks::default();
        assert_eq!(marks.feed(b"\x1b[32mvite\x1b[0m ready"), None);
        assert_eq!(marks.feed(b"\x1b]633;D;oops\x07"), None);
        assert_eq!(marks.feed(b"\x1b]633;D;;true\x07"), None);
        assert_eq!(marks.feed(b"\x1b]0;title\x07"), None);
    }

    #[test]
    fn a_command_with_control_bytes_keeps_only_the_status() {
        let mut marks = ExitMarks::default();
        assert_eq!(marks.feed(b"\x1b]633;D;1;a\tb\x07"), code(1));
        assert_eq!(marks.feed(b"\x1b]633;D;1;\xff\xfe\x07"), code(1));
    }
}

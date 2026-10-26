use std::sync::Arc;
use std::time::Duration;

use tokio::io::{AsyncBufRead, AsyncBufReadExt};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

pub(super) const MAX_LINE_BYTES: usize = 1024 * 1024;
pub(super) const MAX_CONNECTIONS: usize = 32;
pub(super) const LINE_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Debug, PartialEq, Eq)]
pub(super) enum LineOutcome {
    Line(String),
    Closed,
    TooLong,
    TimedOut,
}

pub(super) struct ReadLineParams<'a, R> {
    pub(super) reader: &'a mut R,
    pub(super) max_bytes: usize,
    pub(super) timeout: Duration,
}

pub(super) async fn read_line<R: AsyncBufRead + Unpin>(
    ReadLineParams {
        reader,
        max_bytes,
        timeout,
    }: ReadLineParams<'_, R>,
) -> LineOutcome {
    let read = async {
        let mut line: Vec<u8> = Vec::new();
        loop {
            let Ok(chunk) = reader.fill_buf().await else {
                return LineOutcome::Closed;
            };
            if chunk.is_empty() {
                if line.is_empty() {
                    return LineOutcome::Closed;
                }
                return LineOutcome::Line(String::from_utf8_lossy(&line).into_owned());
            }
            let newline = chunk.iter().position(|byte| *byte == b'\n');
            let taken = newline.unwrap_or(chunk.len());
            if line.len() + taken > max_bytes {
                return LineOutcome::TooLong;
            }
            line.extend_from_slice(&chunk[..taken]);
            let consumed = match newline {
                Some(_) => taken + 1,
                None => taken,
            };
            reader.consume(consumed);
            if newline.is_some() {
                return LineOutcome::Line(String::from_utf8_lossy(&line).into_owned());
            }
        }
    };
    tokio::time::timeout(timeout, read)
        .await
        .unwrap_or(LineOutcome::TimedOut)
}

pub(super) fn acquire_slot(slots: &Arc<Semaphore>) -> Option<OwnedSemaphorePermit> {
    slots.clone().try_acquire_owned().ok()
}

#[cfg(unix)]
pub(super) fn is_same_user(peer_uid: Option<u32>) -> bool {
    let own = unsafe { libc::geteuid() };
    peer_uid == Some(own)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncWriteExt, BufReader};

    const SHORT: Duration = Duration::from_millis(50);

    async fn read_from(bytes: &[u8], max_bytes: usize) -> Vec<LineOutcome> {
        let mut reader = BufReader::new(bytes);
        let mut outcomes = Vec::new();
        loop {
            let outcome = read_line(ReadLineParams {
                reader: &mut reader,
                max_bytes,
                timeout: SHORT,
            })
            .await;
            let is_last = !matches!(outcome, LineOutcome::Line(_));
            outcomes.push(outcome);
            if is_last {
                return outcomes;
            }
        }
    }

    #[tokio::test]
    async fn lines_come_back_one_by_one_and_the_last_unterminated_line_too() {
        let outcomes = read_from(b"one\ntwo\nthree", 64).await;
        assert_eq!(
            outcomes,
            vec![
                LineOutcome::Line("one".into()),
                LineOutcome::Line("two".into()),
                LineOutcome::Line("three".into()),
                LineOutcome::Closed,
            ]
        );
    }

    #[tokio::test]
    async fn a_line_of_one_mebibyte_passes_and_one_byte_more_is_refused() {
        let mut exact = vec![b'a'; MAX_LINE_BYTES];
        exact.push(b'\n');
        let outcomes = read_from(&exact, MAX_LINE_BYTES).await;
        assert_eq!(outcomes[0], LineOutcome::Line("a".repeat(MAX_LINE_BYTES)));

        let mut over = vec![b'a'; MAX_LINE_BYTES + 1];
        over.push(b'\n');
        let outcomes = read_from(&over, MAX_LINE_BYTES).await;
        assert_eq!(outcomes, vec![LineOutcome::TooLong]);
    }

    #[tokio::test]
    async fn a_long_line_without_a_newline_is_refused_before_it_is_buffered() {
        let endless = vec![b'a'; MAX_LINE_BYTES * 2];
        let outcomes = read_from(&endless, MAX_LINE_BYTES).await;
        assert_eq!(outcomes, vec![LineOutcome::TooLong]);
    }

    #[tokio::test]
    async fn a_peer_that_goes_quiet_times_out() {
        let (mut client, server) = tokio::io::duplex(64);
        client.write_all(b"half a li").await.expect("written");
        let mut reader = BufReader::new(server);
        let outcome = read_line(ReadLineParams {
            reader: &mut reader,
            max_bytes: 64,
            timeout: SHORT,
        })
        .await;
        assert_eq!(outcome, LineOutcome::TimedOut);
    }

    #[test]
    fn a_connection_over_the_limit_gets_no_slot_until_one_is_freed() {
        let slots = Arc::new(Semaphore::new(2));
        let first = acquire_slot(&slots).expect("first");
        let _second = acquire_slot(&slots).expect("second");
        assert!(acquire_slot(&slots).is_none());
        drop(first);
        assert!(acquire_slot(&slots).is_some());
    }

    #[cfg(unix)]
    #[test]
    fn only_the_same_effective_user_is_served() {
        let own = unsafe { libc::geteuid() };
        assert!(is_same_user(Some(own)));
        assert!(!is_same_user(Some(own.wrapping_add(1))));
        assert!(!is_same_user(None));
    }
}

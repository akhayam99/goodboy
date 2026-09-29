use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::BridgeError;

/// Noise transport cap: a single ciphertext must fit 65535 bytes.
pub const NOISE_MAX: usize = 65535;

/// Reads one on-wire frame: `u32 big-endian length || bytes[length]`.
/// The length counts only the ciphertext bytes that follow.
pub async fn read_frame(stream: &mut TcpStream) -> Result<Vec<u8>, BridgeError> {
    let mut len_buf = [0u8; 4];
    stream
        .read_exact(&mut len_buf)
        .await
        .map_err(BridgeError::Io)?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len == 0 || len > NOISE_MAX {
        return Err(BridgeError::Protocol(format!("bad frame length {len}")));
    }
    let mut body = vec![0u8; len];
    stream
        .read_exact(&mut body)
        .await
        .map_err(BridgeError::Io)?;
    Ok(body)
}

/// Writes one on-wire frame with the u32 big-endian length prefix.
pub async fn write_frame(stream: &mut TcpStream, body: &[u8]) -> Result<(), BridgeError> {
    if body.len() > NOISE_MAX {
        return Err(BridgeError::Protocol(format!(
            "frame too large: {}",
            body.len()
        )));
    }
    let len = (body.len() as u32).to_be_bytes();
    stream.write_all(&len).await.map_err(BridgeError::Io)?;
    stream.write_all(body).await.map_err(BridgeError::Io)?;
    stream.flush().await.map_err(BridgeError::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;

    async fn pair() -> (TcpStream, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (client, accepted) = tokio::join!(TcpStream::connect(addr), listener.accept());
        (client.unwrap(), accepted.unwrap().0)
    }

    #[tokio::test]
    async fn a_frame_round_trips_through_a_socket() {
        let (mut writer, mut reader) = pair().await;

        write_frame(&mut writer, b"hello phone").await.unwrap();
        write_frame(&mut writer, &[0u8, 255, 1]).await.unwrap();

        assert_eq!(read_frame(&mut reader).await.unwrap(), b"hello phone");
        assert_eq!(read_frame(&mut reader).await.unwrap(), [0u8, 255, 1]);
    }

    #[tokio::test]
    async fn the_wire_format_is_a_big_endian_u32_length_then_the_body() {
        let (mut writer, mut reader) = pair().await;
        write_frame(&mut writer, &[9u8; 300]).await.unwrap();

        let mut prefix = [0u8; 4];
        reader.read_exact(&mut prefix).await.unwrap();

        assert_eq!(prefix, [0, 0, 1, 44]);
        let mut body = vec![0u8; 300];
        reader.read_exact(&mut body).await.unwrap();
        assert_eq!(body, vec![9u8; 300]);
    }

    #[tokio::test]
    async fn a_frame_of_exactly_the_noise_maximum_is_accepted() {
        let (mut writer, mut reader) = pair().await;
        let body = vec![3u8; NOISE_MAX];

        let (written, read) =
            tokio::join!(write_frame(&mut writer, &body), read_frame(&mut reader));

        written.unwrap();
        assert_eq!(read.unwrap(), body);
    }

    #[tokio::test]
    async fn writing_more_than_the_noise_maximum_is_refused_before_any_byte_is_sent() {
        let (mut writer, mut reader) = pair().await;

        let result = write_frame(&mut writer, &vec![0u8; NOISE_MAX + 1]).await;

        assert!(matches!(result, Err(BridgeError::Protocol(_))));
        drop(writer);
        assert!(matches!(
            read_frame(&mut reader).await,
            Err(BridgeError::Io(_))
        ));
    }

    #[tokio::test]
    async fn a_zero_length_frame_is_refused() {
        let (mut writer, mut reader) = pair().await;
        writer.write_all(&0u32.to_be_bytes()).await.unwrap();

        let result = read_frame(&mut reader).await;

        assert!(matches!(result, Err(BridgeError::Protocol(_))));
    }

    #[tokio::test]
    async fn an_oversized_length_prefix_is_refused_without_waiting_for_a_body() {
        let (mut writer, mut reader) = pair().await;
        writer
            .write_all(&((NOISE_MAX as u32) + 1).to_be_bytes())
            .await
            .unwrap();

        let result = read_frame(&mut reader).await;

        assert!(matches!(result, Err(BridgeError::Protocol(_))));
    }

    #[tokio::test]
    async fn a_connection_cut_mid_frame_is_an_io_error() {
        let (mut writer, mut reader) = pair().await;
        writer.write_all(&10u32.to_be_bytes()).await.unwrap();
        writer.write_all(b"abc").await.unwrap();
        drop(writer);

        let result = read_frame(&mut reader).await;

        assert!(matches!(result, Err(BridgeError::Io(_))));
    }
}

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
    stream.read_exact(&mut body).await.map_err(BridgeError::Io)?;
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

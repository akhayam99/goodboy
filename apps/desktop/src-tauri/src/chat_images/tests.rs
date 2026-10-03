use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::*;

const CHAT: &str = "6f616b42-0ed8-471e-823f-ee4aca6b7ce9";
const RUN: &str = "1d2c3b4a-0ed8-471e-823f-ee4aca6b7ce9";
const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 1, 2, 3];

fn scratch(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "goodboy-chat-images-{name}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    root
}

fn image(id: &str, message_id: &str, file_name: &str) -> ChatImage {
    ChatImage {
        id: id.to_string(),
        message_id: message_id.to_string(),
        file_name: file_name.to_string(),
    }
}

#[cfg(unix)]
fn mode_of(path: &Path) -> u32 {
    use std::os::unix::fs::PermissionsExt;
    fs::metadata(path).unwrap().permissions().mode() & 0o777
}

#[test]
fn an_image_written_for_a_chat_reads_back_as_a_data_url() {
    let store = scratch("roundtrip");
    let size = write_image_in(&store, CHAT, "img-1", "checkout-502.png", PNG).unwrap();
    assert_eq!(size, PNG.len() as u64);
    let url = read_image_in(&store, CHAT, &image("img-1", "m1", "checkout-502.png")).unwrap();
    assert_eq!(
        url,
        format!("data:image/png;base64,{}", STANDARD.encode(PNG))
    );
    remove_chat_in(&store, CHAT).unwrap();
    assert!(!store.join(CHAT).exists());
}

#[test]
fn only_small_images_with_plain_ids_are_stored() {
    let store = scratch("refusals");
    assert!(matches!(
        write_image_in(&store, CHAT, "img-1", "notes.pdf", PNG),
        Err(ChatImageError::NotAnImage)
    ));
    assert!(matches!(
        write_image_in(
            &store,
            CHAT,
            "img-1",
            "big.png",
            &vec![0; MAX_IMAGE_BYTES + 1]
        ),
        Err(ChatImageError::TooLarge)
    ));
    for bad in ["../escape", "a/b", "", "-rf"] {
        assert!(matches!(
            write_image_in(&store, bad, "img-1", "a.png", PNG),
            Err(ChatImageError::InvalidId(_))
        ));
        assert!(matches!(
            write_image_in(&store, CHAT, bad, "a.png", PNG),
            Err(ChatImageError::InvalidId(_))
        ));
    }
    write_image_in(&store, CHAT, "img-2", "../../outside.png", PNG).unwrap();
    assert!(store.join(CHAT).join("img-2-outside.png").is_file());
    assert!(!store.join("outside.png").exists());
}

#[cfg(unix)]
#[test]
fn the_turn_root_is_read_only_and_holds_only_the_chat_images() {
    let store = scratch("store");
    let temp = scratch("temp");
    write_image_in(&store, CHAT, "img-1", "checkout-502.png", PNG).unwrap();
    write_image_in(&store, CHAT, "img-2", "acme-trace.png", PNG).unwrap();
    let images = vec![
        image("img-1", "earlier", "checkout-502.png"),
        image("img-2", "asked", "acme-trace.png"),
        image("img-3", "asked", "missing.png"),
    ];
    let turn = prepare_turn_images_in(&store, &temp, CHAT, RUN, &images, Some("asked"))
        .unwrap()
        .expect("two images on disk");
    let root = PathBuf::from(&turn.root);
    assert_eq!(root, fs::canonicalize(turn_root_in(&temp, RUN)).unwrap());
    assert!(!root.starts_with(fs::canonicalize(&store).unwrap()));
    assert_eq!(
        turn.images
            .iter()
            .map(|image| (image.file_name.as_str(), image.is_current))
            .collect::<Vec<_>>(),
        vec![("checkout-502.png", false), ("acme-trace.png", true)]
    );
    assert_eq!(mode_of(&root), 0o555);
    for image in &turn.images {
        let path = Path::new(&image.path);
        assert!(path.starts_with(&root));
        assert_eq!(fs::read(path).unwrap(), PNG);
        assert_eq!(mode_of(path), 0o444);
        assert!(fs::OpenOptions::new().write(true).open(path).is_err());
    }
    assert!(fs::write(root.join("new.txt"), b"x").is_err());

    remove_turn_root(&root);
    assert!(!root.exists());
    assert!(store.join(CHAT).join("img-1-checkout-502.png").is_file());
}

#[test]
fn a_chat_without_images_gets_no_turn_root() {
    let store = scratch("empty-store");
    let temp = scratch("empty-temp");
    assert_eq!(
        prepare_turn_images_in(&store, &temp, CHAT, RUN, &[], None).unwrap(),
        None
    );
    let gone = vec![image("img-9", "asked", "gone.png")];
    assert_eq!(
        prepare_turn_images_in(&store, &temp, CHAT, RUN, &gone, Some("asked")).unwrap(),
        None
    );
    assert!(!turn_root_in(&temp, RUN).exists());
    assert!(matches!(
        prepare_turn_images_in(&store, &temp, CHAT, "../run", &gone, None),
        Err(ChatImageError::InvalidId(_))
    ));
}

#[test]
fn the_images_of_a_chat_are_read_from_its_rows_in_order() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "CREATE TABLE chat_message_attachments (id TEXT PRIMARY KEY, chat_id TEXT, message_id TEXT,
           position INTEGER, file_name TEXT, mime_type TEXT, byte_size INTEGER, created_at INTEGER);
         INSERT INTO chat_message_attachments VALUES ('b', 'chat-1', 'm2', 0, 'b.png', 'image/png', 1, 2);
         INSERT INTO chat_message_attachments VALUES ('a2', 'chat-1', 'm1', 1, 'a2.png', 'image/png', 1, 1);
         INSERT INTO chat_message_attachments VALUES ('a1', 'chat-1', 'm1', 0, 'a1.png', 'image/png', 1, 1);
         INSERT INTO chat_message_attachments VALUES ('x', 'chat-2', 'm9', 0, 'x.png', 'image/png', 1, 0);",
    )
    .unwrap();
    let ids: Vec<String> = load_chat_images(&conn, "chat-1")
        .unwrap()
        .into_iter()
        .map(|image| image.id)
        .collect();
    assert_eq!(ids, vec!["a1", "a2", "b"]);
    assert_eq!(
        load_one_image(&conn, "chat-2", "a1").unwrap(),
        None,
        "an image is read only through its own chat"
    );
}

#[test]
fn deleting_a_workspace_removes_its_chat_images_from_disk() {
    let store = scratch("workspace-delete");
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         CREATE TABLE workspaces (id TEXT PRIMARY KEY);
         CREATE TABLE chats (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL
           REFERENCES workspaces(id) ON DELETE CASCADE);
         CREATE TABLE chat_message_attachments (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL
           REFERENCES chats(id) ON DELETE CASCADE, message_id TEXT, position INTEGER,
           file_name TEXT, mime_type TEXT, byte_size INTEGER, created_at INTEGER);
         INSERT INTO workspaces VALUES ('harborline'), ('northwind');
         INSERT INTO chats VALUES ('6f616b42-0ed8-471e-823f-ee4aca6b7ce9', 'harborline');
         INSERT INTO chats VALUES ('kept-chat', 'northwind');
         INSERT INTO chat_message_attachments VALUES
           ('img-1', '6f616b42-0ed8-471e-823f-ee4aca6b7ce9', 'm1', 0, 'checkout-502.png', 'image/png', 7, 1);",
    )
    .unwrap();
    write_image_in(&store, CHAT, "img-1", "checkout-502.png", PNG).unwrap();
    write_image_in(&store, "kept-chat", "img-2", "acme-trace.png", PNG).unwrap();
    let image = store.join(CHAT).join("img-1-checkout-502.png");
    assert!(image.is_file());

    assert_eq!(prune_orphans_in(&store, &conn).unwrap(), 0);
    conn.execute("DELETE FROM workspaces WHERE id = 'harborline'", [])
        .unwrap();
    assert_eq!(prune_orphans_in(&store, &conn).unwrap(), 1);

    assert!(!image.exists());
    assert!(!store.join(CHAT).exists());
    assert!(store
        .join("kept-chat")
        .join("img-2-acme-trace.png")
        .is_file());
    assert_eq!(prune_orphans_in(&store, &conn).unwrap(), 0);
    assert_eq!(
        prune_orphans_in(&store.join("never-created"), &conn).unwrap(),
        0
    );
}

//! 실시간 같이 고르기 — 로컬 WebSocket 서버(호스트)와 접속(참여자).
//!
//! Rust 는 **전달만** 한다. 방 상태(누가 어디를 골랐는지, 채팅, AI 대기열)는 호스트 PC 의
//! 프론트엔드가 갖고 있고, 여기서는 연결을 받아 텍스트 메시지를 이벤트로 올려 주거나 프론트가
//! 준 텍스트를 내려보낸다. 그래서 프로토콜(JSON 모양)은 `src/share/protocol.ts` 에만 있다.
//!
//! 이벤트 (프론트에서 `listen`)
//!   share-host   { gen, kind: "open" | "msg" | "close", peer, addr?, data? }
//!   share-client { gen, kind: "msg" | "close", data?, reason? }
//!
//! `gen` 은 프론트가 시작할 때 넘겨주는 세션 번호다. 서버를 껐다 켜거나 다시 접속했을 때
//! 늦게 도착한 이전 세션의 이벤트를 프론트가 걸러내는 데 쓴다.

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr, UdpSocket};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot, watch};
use tokio_tungstenite::tungstenite::protocol::WebSocketConfig;
use tokio_tungstenite::tungstenite::{self, Message};

/// 메시지 하나의 최대 크기. 방 상태 전체(식당 수십 곳 + 채팅 200개)가 수십 KB 라 넉넉하다.
const MAX_MESSAGE: usize = 1 << 20;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(5);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(6);
const CLOSE_FLUSH_TIMEOUT: Duration = Duration::from_secs(1);
/// 사내 점심 모임 규모를 넘는 접속은 받지 않는다.
const MAX_PEERS: usize = 32;
/// 참여자가 접속하는 경로. 다른 프로그램의 WebSocket 과 섞이지 않게 구분만 한다.
pub const WS_PATH: &str = "/lunchpick";

const EV_HOST: &str = "share-host";
const EV_CLIENT: &str = "share-client";

type Tx = mpsc::UnboundedSender<Message>;

struct Host {
    peers: Arc<Mutex<HashMap<String, Tx>>>,
    stop: watch::Sender<bool>,
}

struct Client {
    tx: Tx,
    stop: watch::Sender<bool>,
}

/// Tauri 가 관리하는 공유 상태. 호스트와 참여는 동시에 하나씩만 열 수 있다.
#[derive(Default)]
pub struct ShareState {
    host: Mutex<Option<Host>>,
    client: Mutex<Option<Client>>,
}

static PEER_SEQ: AtomicU64 = AtomicU64::new(1);

fn ws_config() -> WebSocketConfig {
    WebSocketConfig::default()
        .max_message_size(Some(MAX_MESSAGE))
        .max_frame_size(Some(MAX_MESSAGE))
}

// ---------------------------------------------------------------- 이벤트

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostEvent {
    gen: u64,
    kind: &'static str,
    peer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    addr: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClientEvent {
    gen: u64,
    kind: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

fn emit_host<R: Runtime>(app: &AppHandle<R>, ev: HostEvent) {
    let _ = app.emit(EV_HOST, ev);
}

fn emit_client<R: Runtime>(app: &AppHandle<R>, ev: ClientEvent) {
    let _ = app.emit(EV_CLIENT, ev);
}

// ---------------------------------------------------------------- 주소

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    pub port: u16,
    /// 동료에게 알려줄 이 PC 의 사내망 IPv4 주소들
    pub addrs: Vec<String>,
    /// Windows 컴퓨터 이름 (IP 대신 쓸 수 있는 경우가 많다)
    pub pc_name: String,
}

/// 라우팅 테이블을 이용해 이 PC 의 바깥쪽 IPv4 주소를 알아낸다.
/// UDP `connect` 는 패킷을 보내지 않으므로 네트워크에 흔적이 남지 않는다.
fn local_addrs() -> Vec<String> {
    const PROBES: [&str; 4] = ["10.255.255.255:9", "172.31.255.255:9", "192.168.255.255:9", "8.8.8.8:9"];
    let mut out: Vec<String> = Vec::new();
    for probe in PROBES {
        let Ok(sock) = UdpSocket::bind("0.0.0.0:0") else {
            continue;
        };
        if sock.connect(probe).is_err() {
            continue;
        }
        if let Ok(SocketAddr::V4(a)) = sock.local_addr() {
            let ip = *a.ip();
            if ip.is_unspecified() || ip.is_loopback() || ip.is_link_local() {
                continue;
            }
            let s = ip.to_string();
            if !out.contains(&s) {
                out.push(s);
            }
        }
    }
    out
}

fn pc_name() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_default()
}

#[tauri::command]
pub fn share_local_info(port: u16) -> HostInfo {
    HostInfo {
        port,
        addrs: local_addrs(),
        pc_name: pc_name(),
    }
}

// ---------------------------------------------------------------- 호스트

fn bind_error(port: u16, e: std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::AddrInUse => format!(
            "포트 {port} 는 이미 다른 프로그램이 쓰고 있어요. 다른 포트를 골라 주세요."
        ),
        std::io::ErrorKind::PermissionDenied => {
            format!("포트 {port} 를 열 권한이 없어요. 1024 이상의 다른 포트를 골라 주세요.")
        }
        _ => format!("포트 {port} 로 서버를 열 수 없어요: {e}"),
    }
}

fn stop_host(state: &ShareState) {
    let host = state.host.lock().unwrap().take();
    if let Some(h) = host {
        // 대기 중인 메시지(작별 인사 등)를 먼저 보내고 닫히도록 Close 를 큐 끝에 넣는다.
        for tx in h.peers.lock().unwrap().values() {
            let _ = tx.send(Message::Close(None));
        }
        let _ = h.stop.send(true);
    }
}

#[tauri::command]
pub async fn share_host_start<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ShareState>,
    port: u16,
    gen: u64,
) -> Result<HostInfo, String> {
    if port < 1024 {
        return Err("포트는 1024 ~ 65535 사이로 정해 주세요.".into());
    }
    // 참여 중이었다면 먼저 나온다 — 한 PC 는 호스트와 참여자를 동시에 하지 않는다.
    stop_client(&state);
    stop_host(&state);

    let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port)))
        .await
        .map_err(|e| bind_error(port, e))?;

    let peers: Arc<Mutex<HashMap<String, Tx>>> = Arc::new(Mutex::new(HashMap::new()));
    let (stop_tx, stop_rx) = watch::channel(false);

    {
        let app = app.clone();
        let peers = peers.clone();
        let mut stop = stop_rx.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::select! {
                    _ = stop.changed() => break,
                    r = listener.accept() => match r {
                        Ok((stream, addr)) => {
                            if peers.lock().unwrap().len() >= MAX_PEERS {
                                drop(stream);
                                continue;
                            }
                            let _ = stream.set_nodelay(true);
                            tauri::async_runtime::spawn(serve_peer(
                                app.clone(),
                                gen,
                                stream,
                                addr,
                                peers.clone(),
                                stop_rx.clone(),
                            ));
                        }
                        // 파일 핸들 고갈 같은 일시 오류에서 바쁜 루프가 돌지 않게 잠깐 쉰다.
                        Err(_) => tokio::time::sleep(Duration::from_millis(200)).await,
                    }
                }
            }
        });
    }

    *state.host.lock().unwrap() = Some(Host {
        peers,
        stop: stop_tx,
    });

    Ok(HostInfo {
        port,
        addrs: local_addrs(),
        pc_name: pc_name(),
    })
}

async fn serve_peer<R: Runtime>(
    app: AppHandle<R>,
    gen: u64,
    stream: TcpStream,
    addr: SocketAddr,
    peers: Arc<Mutex<HashMap<String, Tx>>>,
    mut stop: watch::Receiver<bool>,
) {
    let accepted = tokio::time::timeout(
        HANDSHAKE_TIMEOUT,
        tokio_tungstenite::accept_async_with_config(stream, Some(ws_config())),
    )
    .await;
    let ws = match accepted {
        Ok(Ok(ws)) => ws,
        _ => return,
    };

    let id = format!("c{}", PEER_SEQ.fetch_add(1, Ordering::SeqCst));
    let (mut sink, mut source) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let (done_tx, mut done_rx) = oneshot::channel::<()>();
    peers.lock().unwrap().insert(id.clone(), tx);

    emit_host(
        &app,
        HostEvent {
            gen,
            kind: "open",
            peer: id.clone(),
            addr: Some(ip_text(addr.ip())),
            data: None,
        },
    );

    // 쓰기 전담 태스크. Close 를 보내면(내보내기·서버 종료) 끝나고, 읽기 루프도 따라 끝난다.
    let writer = tauri::async_runtime::spawn(async move {
        while let Some(m) = rx.recv().await {
            let closing = matches!(m, Message::Close(_));
            if sink.send(m).await.is_err() || closing {
                break;
            }
        }
        let _ = sink.close().await;
        let _ = done_tx.send(());
    });

    loop {
        tokio::select! {
            _ = stop.changed() => break,
            _ = &mut done_rx => break,
            m = source.next() => match m {
                Some(Ok(Message::Text(t))) => emit_host(
                    &app,
                    HostEvent { gen, kind: "msg", peer: id.clone(), addr: None, data: Some(t.to_string()) },
                ),
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                // ping/pong 은 tungstenite 가 처리하고, 바이너리는 쓰지 않는다.
                Some(Ok(_)) => {}
            }
        }
    }

    let tx = peers.lock().unwrap().remove(&id);
    if let Some(tx) = tx {
        let _ = tx.send(Message::Close(None));
    }
    let _ = tokio::time::timeout(CLOSE_FLUSH_TIMEOUT, writer).await;

    emit_host(
        &app,
        HostEvent {
            gen,
            kind: "close",
            peer: id,
            addr: None,
            data: None,
        },
    );
}

fn ip_text(ip: IpAddr) -> String {
    match ip {
        IpAddr::V6(v6) => v6
            .to_ipv4_mapped()
            .map(|v4| v4.to_string())
            .unwrap_or_else(|| v6.to_string()),
        IpAddr::V4(v4) => v4.to_string(),
    }
}

#[tauri::command]
pub fn share_host_stop(state: State<'_, ShareState>) {
    stop_host(&state);
}

/// 지정한 연결들에 같은 텍스트를 보낸다 (방 상태 방송, 개별 응답).
#[tauri::command]
pub fn share_host_send(
    state: State<'_, ShareState>,
    peers: Vec<String>,
    text: String,
) -> Result<(), String> {
    let guard = state.host.lock().unwrap();
    let host = guard.as_ref().ok_or("공유 서버가 꺼져 있어요.")?;
    let map = host.peers.lock().unwrap();
    let msg = Message::text(text);
    for p in &peers {
        if let Some(tx) = map.get(p) {
            let _ = tx.send(msg.clone());
        }
    }
    Ok(())
}

/// 연결 하나를 끊는다 (내보내기, 인사 없이 붙은 연결 정리).
#[tauri::command]
pub fn share_host_kick(state: State<'_, ShareState>, peer: String) {
    let guard = state.host.lock().unwrap();
    if let Some(host) = guard.as_ref() {
        if let Some(tx) = host.peers.lock().unwrap().get(&peer) {
            let _ = tx.send(Message::Close(None));
        }
    }
}

// ---------------------------------------------------------------- 참여 (클라이언트)

fn stop_client(state: &ShareState) {
    let client = state.client.lock().unwrap().take();
    if let Some(c) = client {
        let _ = c.tx.send(Message::Close(None));
        let _ = c.stop.send(true);
    }
}

fn connect_error(host: &str, port: u16, e: tungstenite::Error) -> String {
    use std::io::ErrorKind;
    match e {
        tungstenite::Error::Io(io) => match io.kind() {
            ErrorKind::ConnectionRefused => format!(
                "{host}:{port} 에 연결할 수 없어요. 호스트가 서버를 켰는지, 포트가 맞는지 확인해 주세요."
            ),
            ErrorKind::TimedOut => format!(
                "{host}:{port} 가 응답하지 않아요. 같은 사내망인지, 방화벽이 막고 있지 않은지 확인해 주세요."
            ),
            _ if io.to_string().to_lowercase().contains("lookup")
                || io.to_string().contains("resolve")
                || io.to_string().contains("호스트") =>
            {
                format!("'{host}' 를 찾을 수 없어요. 호스트 화면에 보이는 IP 주소로 다시 시도해 보세요.")
            }
            _ => format!("{host}:{port} 에 연결할 수 없어요: {io}"),
        },
        tungstenite::Error::Http(res) => format!(
            "{host}:{port} 는 점심픽 공유 서버가 아닌 것 같아요 (HTTP {}).",
            res.status().as_u16()
        ),
        tungstenite::Error::Url(_) => format!("주소 '{host}' 형식이 올바르지 않아요."),
        other => format!("{host}:{port} 에 연결할 수 없어요: {other}"),
    }
}

/// 주소 입력값을 다듬는다. `ws://`·`http://` 접두사나 끝의 `/` 를 붙여 넣어도 받아준다.
fn clean_host(raw: &str) -> Result<String, String> {
    let mut h = raw.trim();
    for p in ["ws://", "wss://", "http://", "https://"] {
        if let Some(rest) = h.strip_prefix(p) {
            h = rest;
        }
    }
    let h = h.trim_end_matches('/');
    if h.is_empty() {
        return Err("호스트 주소를 입력해 주세요.".into());
    }
    if h.chars()
        .any(|c| c.is_whitespace() || matches!(c, '/' | '?' | '#' | '@'))
    {
        return Err(format!("주소 '{h}' 형식이 올바르지 않아요."));
    }
    Ok(h.to_string())
}

#[tauri::command]
pub async fn share_client_connect<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, ShareState>,
    host: String,
    port: u16,
    gen: u64,
) -> Result<(), String> {
    if port == 0 {
        return Err("포트를 확인해 주세요.".into());
    }
    let host = clean_host(&host)?;
    stop_host(&state);
    stop_client(&state);

    // IPv6 리터럴은 대괄호로 감싼다.
    let authority = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]:{port}")
    } else {
        format!("{host}:{port}")
    };
    let url = format!("ws://{authority}{WS_PATH}");

    let connected = tokio::time::timeout(
        CONNECT_TIMEOUT,
        tokio_tungstenite::connect_async_with_config(url, Some(ws_config()), true),
    )
    .await
    .map_err(|_| {
        format!(
            "{host}:{port} 가 응답하지 않아요. 같은 사내망인지, 방화벽이 막고 있지 않은지 확인해 주세요."
        )
    })?;
    let (ws, _) = connected.map_err(|e| connect_error(&host, port, e))?;

    let (mut sink, mut source) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let (stop_tx, mut stop_rx) = watch::channel(false);
    let (done_tx, mut done_rx) = oneshot::channel::<()>();

    let writer = tauri::async_runtime::spawn(async move {
        while let Some(m) = rx.recv().await {
            let closing = matches!(m, Message::Close(_));
            if sink.send(m).await.is_err() || closing {
                break;
            }
        }
        let _ = sink.close().await;
        let _ = done_tx.send(());
    });

    {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let reason: Option<String> = loop {
                tokio::select! {
                    _ = stop_rx.changed() => break None,
                    _ = &mut done_rx => break None,
                    m = source.next() => match m {
                        Some(Ok(Message::Text(t))) => emit_client(
                            &app,
                            ClientEvent { gen, kind: "msg", data: Some(t.to_string()), reason: None },
                        ),
                        Some(Ok(Message::Close(frame))) => {
                            break frame.map(|f| f.reason.to_string()).filter(|r| !r.is_empty())
                        }
                        None => break None,
                        Some(Err(e)) => break Some(e.to_string()),
                        Some(Ok(_)) => {}
                    }
                }
            };
            let _ = tokio::time::timeout(CLOSE_FLUSH_TIMEOUT, writer).await;
            emit_client(
                &app,
                ClientEvent {
                    gen,
                    kind: "close",
                    data: None,
                    reason,
                },
            );
        });
    }

    *state.client.lock().unwrap() = Some(Client { tx, stop: stop_tx });
    Ok(())
}

#[tauri::command]
pub fn share_client_send(state: State<'_, ShareState>, text: String) -> Result<(), String> {
    let guard = state.client.lock().unwrap();
    let client = guard.as_ref().ok_or("호스트에 연결돼 있지 않아요.")?;
    client
        .tx
        .send(Message::text(text))
        .map_err(|_| "호스트와의 연결이 끊겼어요.".to_string())
}

#[tauri::command]
pub fn share_client_disconnect(state: State<'_, ShareState>) {
    stop_client(&state);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc as std_mpsc;
    use tauri::test::{mock_app, MockRuntime};
    use tauri::{Listener, Manager};

    fn free_port() -> u16 {
        std::net::TcpListener::bind("127.0.0.1:0")
            .unwrap()
            .local_addr()
            .unwrap()
            .port()
    }

    fn app_with_events(event: &'static str) -> (tauri::App<MockRuntime>, std_mpsc::Receiver<serde_json::Value>) {
        let app = mock_app();
        app.manage(ShareState::default());
        let (tx, rx) = std_mpsc::channel();
        app.handle().listen(event, move |e| {
            let _ = tx.send(serde_json::from_str(e.payload()).unwrap());
        });
        (app, rx)
    }

    fn next_kind(rx: &std_mpsc::Receiver<serde_json::Value>, kind: &str) -> serde_json::Value {
        loop {
            let v = rx.recv_timeout(Duration::from_secs(5)).expect("이벤트가 오지 않음");
            if v["kind"] == kind {
                return v;
            }
        }
    }

    #[test]
    fn host_relays_text_both_ways_and_kicks() {
        let (app, rx) = app_with_events(EV_HOST);
        let handle = app.handle().clone();
        let port = free_port();
        tauri::async_runtime::block_on(async {
            let info = share_host_start(handle.clone(), handle.state::<ShareState>(), port, 7)
                .await
                .unwrap();
            assert_eq!(info.port, port);

            let (mut ws, _) = tokio_tungstenite::connect_async(format!("ws://127.0.0.1:{port}{WS_PATH}"))
                .await
                .unwrap();
            let open = next_kind(&rx, "open");
            assert_eq!(open["gen"], 7);
            assert_eq!(open["addr"], "127.0.0.1");
            let peer = open["peer"].as_str().unwrap().to_string();

            ws.send(Message::text("안녕")).await.unwrap();
            let msg = next_kind(&rx, "msg");
            assert_eq!(msg["peer"], peer.as_str());
            assert_eq!(msg["data"], "안녕");

            share_host_send(handle.state::<ShareState>(), vec![peer.clone()], "반가워".into()).unwrap();
            let got = ws.next().await.unwrap().unwrap();
            assert_eq!(got.into_text().unwrap().as_str(), "반가워");

            share_host_kick(handle.state::<ShareState>(), peer.clone());
            // 서버가 Close 를 보낸다 → 스트림이 닫힌다.
            loop {
                match ws.next().await {
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    Some(Ok(_)) => {}
                }
            }
            let close = next_kind(&rx, "close");
            assert_eq!(close["peer"], peer.as_str());

            share_host_stop(handle.state::<ShareState>());
        });
    }

    #[test]
    fn same_port_twice_reports_busy() {
        let (a, _ra) = app_with_events(EV_HOST);
        let (b, _rb) = app_with_events(EV_HOST);
        let port = free_port();
        tauri::async_runtime::block_on(async {
            share_host_start(a.handle().clone(), a.state::<ShareState>(), port, 1)
                .await
                .unwrap();
            let err = share_host_start(b.handle().clone(), b.state::<ShareState>(), port, 1)
                .await
                .err()
                .unwrap();
            assert!(err.contains("이미 다른 프로그램"), "{err}");
            share_host_stop(a.state::<ShareState>());
        });
    }

    #[test]
    fn client_connects_to_host_and_sees_close() {
        let (host, host_rx) = app_with_events(EV_HOST);
        let (guest, guest_rx) = app_with_events(EV_CLIENT);
        let port = free_port();
        tauri::async_runtime::block_on(async {
            share_host_start(host.handle().clone(), host.state::<ShareState>(), port, 3)
                .await
                .unwrap();
            share_client_connect(
                guest.handle().clone(),
                guest.state::<ShareState>(),
                "ws://127.0.0.1/".into(),
                port,
                11,
            )
            .await
            .unwrap();
            let peer = next_kind(&host_rx, "open")["peer"].as_str().unwrap().to_string();

            share_client_send(guest.state::<ShareState>(), "{\"t\":\"ping\"}".into()).unwrap();
            assert_eq!(next_kind(&host_rx, "msg")["data"], "{\"t\":\"ping\"}");

            share_host_send(host.state::<ShareState>(), vec![peer], "{\"t\":\"pong\"}".into()).unwrap();
            let m = next_kind(&guest_rx, "msg");
            assert_eq!(m["gen"], 11);
            assert_eq!(m["data"], "{\"t\":\"pong\"}");

            // 호스트가 서버를 끄면 참여자에게 close 이벤트가 온다.
            share_host_stop(host.state::<ShareState>());
            let c = next_kind(&guest_rx, "close");
            assert_eq!(c["gen"], 11);
        });
    }

    #[test]
    fn connect_to_closed_port_is_explained() {
        let (guest, _rx) = app_with_events(EV_CLIENT);
        let port = free_port();
        let err = tauri::async_runtime::block_on(share_client_connect(
            guest.handle().clone(),
            guest.state::<ShareState>(),
            "127.0.0.1".into(),
            port,
            1,
        ))
        .err()
        .unwrap();
        assert!(err.contains("호스트가 서버를 켰는지"), "{err}");
    }

    #[test]
    fn clean_host_accepts_pasted_urls() {
        assert_eq!(clean_host(" 192.168.0.12 ").unwrap(), "192.168.0.12");
        assert_eq!(clean_host("ws://pc-01/").unwrap(), "pc-01");
        assert_eq!(clean_host("http://10.0.0.5").unwrap(), "10.0.0.5");
        assert!(clean_host("").is_err());
        assert!(clean_host("a b").is_err());
        assert!(clean_host("evil/path").is_err());
    }

    #[test]
    fn ipv4_mapped_addresses_are_shown_as_v4() {
        let v6: IpAddr = "::ffff:192.168.0.7".parse().unwrap();
        assert_eq!(ip_text(v6), "192.168.0.7");
    }
}

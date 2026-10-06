//! Samsung SDS FabriX "LLM Serving APIs" 클라이언트.
//!
//! 계약은 바탕화면 `FabrixSample` 에서 확인한 그대로다:
//!   base   = {endpointUrl}/{prefixPath}          (prefixPath 기본값 "openapi/llm")
//!   chat   = POST {base}/chat/completions
//!   models = GET  {base}/v1/models               ({base}/models 는 405)
//!
//! 헤더: x-fabrix-client: <JWT> / x-openapi-token: Bearer <JWT> / x-llm-model-id: "16"
//! Authorization 헤더는 쓰지 않는다. body 의 model 은 무시되므로 "/mnt/models" 를 넣는다.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

use crate::secrets;

const BODY_MODEL_PLACEHOLDER: &str = "/mnt/models";
/// 추론 모델은 reasoning 이 토큰을 먼저 소진한다. 작게 주면 content=null + finish_reason=length.
const MAX_TOKENS: u32 = 4096;
const TIMEOUT_SECS: u64 = 60;

/// 프론트엔드가 "키 미설정" 을 구분해 안내 문구를 바꾸기 위한 센티넬.
pub const ERR_NO_CREDS: &str = "NO_CREDENTIALS";

const SYSTEM_PROMPT: &str = "당신은 한국 직장인의 점심 식당을 골라주는 큐레이터입니다. 요청한 JSON 형식만 출력하고 다른 설명은 덧붙이지 않습니다.";

// ---------------------------------------------------------------- 설정

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FabrixConf {
    pub endpoint_url: String,
    #[serde(default = "default_prefix")]
    pub prefix_path: String,
    #[serde(default = "default_model")]
    pub model_id: String,
}

fn default_prefix() -> String {
    "openapi/llm".to_string()
}

fn default_model() -> String {
    "16".to_string()
}

impl FabrixConf {
    fn base_url(&self) -> Result<String, String> {
        let ep = self.endpoint_url.trim().trim_end_matches('/');
        if ep.is_empty() {
            return Err("설정에서 FabriX Endpoint URL 을 입력해 주세요.".into());
        }
        if !ep.starts_with("http://") && !ep.starts_with("https://") {
            return Err("Endpoint URL 은 http:// 또는 https:// 로 시작해야 해요.".into());
        }
        let prefix = self.prefix_path.trim().trim_matches('/');
        Ok(if prefix.is_empty() {
            ep.to_string()
        } else {
            format!("{ep}/{prefix}")
        })
    }

    fn models_url(&self) -> Result<String, String> {
        Ok(format!("{}/v1/models", self.base_url()?))
    }

    fn chat_url(&self) -> Result<String, String> {
        Ok(format!("{}/chat/completions", self.base_url()?))
    }
}

struct Creds {
    client_key: String,
    openapi_token: String,
}

fn load_creds() -> Result<Creds, String> {
    let client_key = secrets::read(secrets::CLIENT_KEY)?.unwrap_or_default();
    let raw_token = secrets::read(secrets::OPENAPI_TOKEN)?.unwrap_or_default();
    if client_key.trim().is_empty() || raw_token.trim().is_empty() {
        return Err(ERR_NO_CREDS.into());
    }
    // 흔한 실수: 발급 토큰만 넣고 Bearer 접두사를 빠뜨림 -> 자동 보정한다.
    let t = raw_token.trim();
    let openapi_token = if t.len() >= 7 && t[..7].eq_ignore_ascii_case("bearer ") {
        t.to_string()
    } else {
        format!("Bearer {t}")
    };
    Ok(Creds {
        client_key: client_key.trim().to_string(),
        openapi_token,
    })
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP 클라이언트를 만들 수 없어요: {e}"))
}

// ---------------------------------------------------------------- 에러 정규화

/// FabriX 는 계층마다 다른 3종의 에러 본문을 쓴다 (litellm / OIDC / WSO2 게이트웨이).
/// 판별 순서가 중요하다: OIDC 의 `error` 는 문자열이라 1번 분기에 걸리지 않아야 한다.
fn err_message(status: u16, retry_after: Option<String>, body: &str) -> String {
    let v: Value = serde_json::from_str(body).unwrap_or(Value::Null);

    // 1) litellm / OpenAI 형식: {"error": {"message", "type", "param", "code"}}
    if let Some(e) = v.get("error").and_then(Value::as_object) {
        let msg = e
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let mut out = if msg.is_empty() {
            format!("HTTP {status}")
        } else {
            msg.clone()
        };
        if status == 401 && msg.contains("proxy server token") {
            out.push_str("\n(x-llm-model-id 헤더가 없을 때 나는 오류예요. 모델 ID를 확인하세요.)");
        } else if status == 404 && msg.to_lowercase().contains("model") {
            out.push_str("\n(존재하지 않는 모델 ID예요. 모델 불러오기로 확인하세요.)");
        }
        return out;
    }

    // 2) OIDC 형식: {"statusCode":401,"code":"OIDC-TOKEN-17","error":"Unauthorized",...}
    if let Some(code) = v.get("code").and_then(Value::as_str) {
        if code.starts_with("OIDC") {
            let msg = v
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| v.get("error").and_then(Value::as_str))
                .unwrap_or("Unauthorized");
            return format!(
                "{msg} ({code})\nx-fabrix-client 키가 잘못되었거나 만료됐어요. FabriX 포털에서 재발급하세요."
            );
        }
    }

    // 3) WSO2 API 게이트웨이 형식: {"code":"900901","message":"...","description":"..."}
    if let Some(code) = v.get("code") {
        let code_s = code
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| code.to_string());
        let msg = v.get("message").and_then(Value::as_str).unwrap_or("");
        let desc = v.get("description").and_then(Value::as_str).unwrap_or("");
        let mut out = match (msg.is_empty(), desc.is_empty()) {
            (true, true) => format!("HTTP {status}"),
            (false, true) => msg.to_string(),
            (true, false) => desc.to_string(),
            (false, false) => format!("{msg}: {desc}"),
        };
        if code_s == "900804" {
            if let Some(next) = v.get("nextAccessTime").and_then(Value::as_str) {
                out.push_str(&format!("\n다시 호출할 수 있는 시각: {next}"));
            }
            if let Some(ra) = retry_after {
                out.push_str(&format!("\n(Retry-After: {ra})"));
            }
        } else if code_s.starts_with("9009") {
            out.push_str("\nx-openapi-token 값을 확인하세요 (Bearer 접두사 포함, 만료 여부).");
        }
        return out;
    }

    let trimmed = body.trim();
    if trimmed.is_empty() {
        format!("HTTP {status}")
    } else {
        let snippet: String = trimmed.chars().take(400).collect();
        format!("HTTP {status}: {snippet}")
    }
}

async fn check(res: reqwest::Response) -> Result<String, String> {
    let status = res.status();
    let retry_after = res
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let body = res.text().await.unwrap_or_default();
    if status.is_success() {
        Ok(body)
    } else {
        Err(err_message(status.as_u16(), retry_after, &body))
    }
}

// ---------------------------------------------------------------- 모델 목록

#[derive(Debug, Deserialize)]
struct LocalizedText {
    #[serde(rename = "languageCode", default)]
    language_code: String,
    #[serde(default)]
    content: String,
}

#[derive(Debug, Deserialize)]
struct RawModel {
    #[serde(rename = "modelId", default)]
    model_id: Value,
    #[serde(rename = "modelServingId", default)]
    model_serving_id: String,
    #[serde(default)]
    name: Vec<LocalizedText>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FabrixModel {
    pub model_id: String,
    pub label: String,
    pub serving_id: String,
}

fn localized(list: &[LocalizedText], fallback: &str) -> String {
    list.iter()
        .find(|t| t.language_code == "ko")
        .or_else(|| list.iter().find(|t| t.language_code == "en"))
        .or_else(|| list.first())
        .map(|t| t.content.clone())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn id_to_string(v: &Value) -> String {
    v.as_str()
        .map(str::to_string)
        .or_else(|| v.as_i64().map(|n| n.to_string()))
        .unwrap_or_default()
}

async fn fetch_models(conf: &FabrixConf) -> Result<Vec<FabrixModel>, String> {
    let creds = load_creds()?;
    let res = client()?
        .get(conf.models_url()?)
        .header("x-fabrix-client", &creds.client_key)
        .header("x-openapi-token", &creds.openapi_token)
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("FabriX 에 연결할 수 없어요: {e}"))?;
    let body = check(res).await?;
    // 주의: 응답은 객체가 아니라 배열이다.
    let raw: Vec<RawModel> =
        serde_json::from_str(&body).map_err(|e| format!("모델 목록을 해석할 수 없어요: {e}"))?;
    Ok(raw
        .into_iter()
        .filter_map(|m| {
            let id = id_to_string(&m.model_id);
            if id.is_empty() {
                return None;
            }
            let label = localized(&m.name, &m.model_serving_id);
            Some(FabrixModel {
                model_id: id,
                label,
                serving_id: m.model_serving_id,
            })
        })
        .collect())
}

#[tauri::command]
pub async fn fabrix_models(conf: FabrixConf) -> Result<Vec<FabrixModel>, String> {
    fetch_models(&conf).await
}

#[tauri::command]
pub async fn fabrix_test(conf: FabrixConf) -> Result<String, String> {
    let wanted = conf.model_id.trim().to_string();
    let models = fetch_models(&conf).await?;
    if !models.iter().any(|m| m.model_id == wanted) {
        return Err(format!(
            "자격증명은 정상이지만 모델 ID {wanted} 를 찾을 수 없어요. 모델 불러오기로 선택하세요."
        ));
    }
    Ok(format!("연결 성공 · 모델 {}개", models.len()))
}

// ---------------------------------------------------------------- 추천 (chat)

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct RespMessage {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Deserialize)]
struct RespChoice {
    #[serde(default)]
    message: Option<RespMessage>,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct ChatResponse {
    #[serde(default)]
    choices: Vec<RespChoice>,
}

#[derive(Deserialize)]
struct RawPick {
    #[serde(default)]
    no: Value,
    #[serde(default)]
    reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AiPick {
    pub no: usize,
    pub reason: String,
}

/// 응답 텍스트에서 JSON 배열을 꺼낸다 (목업의 그리디 정규식과 동일한 동작).
fn extract_json_array(text: &str) -> Option<&str> {
    let start = text.find('[')?;
    let end = text.rfind(']')?;
    if end > start {
        Some(&text[start..=end])
    } else {
        None
    }
}

/// chat/completions 를 한 번 호출하고 첫 번째 답변 본문을 돌려준다.
async fn complete(conf: &FabrixConf, messages: Vec<ChatMessage<'_>>) -> Result<String, String> {
    let creds = load_creds()?;
    let model_id = conf.model_id.trim().to_string();
    if model_id.is_empty() {
        return Err("설정에서 모델을 선택해 주세요.".into());
    }
    let body = ChatRequest {
        model: BODY_MODEL_PLACEHOLDER,
        messages,
        max_tokens: MAX_TOKENS,
    };

    let res = client()?
        .post(conf.chat_url()?)
        .header("x-fabrix-client", &creds.client_key)
        .header("x-openapi-token", &creds.openapi_token)
        .header("x-llm-model-id", &model_id)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("FabriX 에 연결할 수 없어요: {e}"))?;
    let text = check(res).await?;

    let parsed: ChatResponse =
        serde_json::from_str(&text).map_err(|e| format!("AI 응답을 해석할 수 없어요: {e}"))?;
    let choice = parsed
        .choices
        .into_iter()
        .next()
        .ok_or("AI 응답에 결과가 없어요.")?;

    // 추론 모델이 max_tokens 에 걸리면 content 에 내부 토큰이 섞여 나온 사례가 있어 신뢰하지 않는다.
    if choice.finish_reason.as_deref() == Some("length") {
        return Err("AI 응답이 길이 제한에 걸렸어요.".into());
    }
    choice
        .message
        .and_then(|m| m.content)
        .filter(|c| !c.trim().is_empty())
        .ok_or_else(|| "AI 가 빈 응답을 보냈어요.".to_string())
}

#[tauri::command]
pub async fn fabrix_recommend(conf: FabrixConf, prompt: String) -> Result<Vec<AiPick>, String> {
    let content = complete(
        &conf,
        vec![
            ChatMessage {
                role: "system",
                content: SYSTEM_PROMPT,
            },
            ChatMessage {
                role: "user",
                content: &prompt,
            },
        ],
    )
    .await?;

    let arr = extract_json_array(&content).ok_or("AI 응답에서 JSON 배열을 찾지 못했어요.")?;
    let raw: Vec<RawPick> =
        serde_json::from_str(arr).map_err(|e| format!("AI 응답 JSON 이 올바르지 않아요: {e}"))?;

    let picks: Vec<AiPick> = raw
        .into_iter()
        .filter_map(|p| {
            let no = p
                .no
                .as_u64()
                .or_else(|| p.no.as_str().and_then(|s| s.trim().parse::<u64>().ok()))?;
            if no == 0 {
                return None;
            }
            Some(AiPick {
                no: no as usize,
                reason: p.reason.unwrap_or_default().trim().to_string(),
            })
        })
        .collect();

    if picks.is_empty() {
        return Err("AI 가 고른 후보가 없어요.".into());
    }
    Ok(picks)
}

// ---------------------------------------------------------------- 같이 고르기 (멀티턴)

#[derive(Debug, Deserialize)]
pub struct ChatTurn {
    pub role: String,
    pub content: String,
}

/// 같이 고르기의 AI 정렬. 참여자들의 요청을 들어온 순서대로 쌓은 대화 전체를 보내고,
/// 답변 본문(JSON 텍스트)을 그대로 돌려준다 — 해석은 프론트(`src/share/ai.ts`)가 한다.
/// 첫 메시지가 system 이 아니면 기본 시스템 프롬프트를 앞에 붙인다.
#[tauri::command]
pub async fn fabrix_chat(conf: FabrixConf, messages: Vec<ChatTurn>) -> Result<String, String> {
    if messages.is_empty() {
        return Err("보낼 메시지가 없어요.".into());
    }
    let mut out: Vec<ChatMessage<'_>> = Vec::with_capacity(messages.len() + 1);
    if messages[0].role != "system" {
        out.push(ChatMessage {
            role: "system",
            content: SYSTEM_PROMPT,
        });
    }
    for m in &messages {
        let role = match m.role.as_str() {
            "system" => "system",
            "user" => "user",
            "assistant" => "assistant",
            other => return Err(format!("알 수 없는 메시지 역할이에요: {other}")),
        };
        out.push(ChatMessage {
            role,
            content: &m.content,
        });
    }
    complete(&conf, out).await
}

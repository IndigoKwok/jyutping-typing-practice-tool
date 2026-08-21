// Cloudflare Worker: GitHub OAuth code -> access_token 交換
// secret 只存在 Worker 環境變量,前端永遠見不到。
//
// 流程:
//   前端把用戶導去 GitHub authorize (redirect_uri 指向本 worker /auth/callback, state 帶回跳頁面 URL)
//   GitHub 回調 /auth/callback?code=...&state=...
//   本 worker 用 client_id+client_secret 換 access_token
//   302 回跳 state 頁面, token 放在 URL fragment (#sync_token=...), 不進伺服器日誌

const TOKEN_URL = "https://github.com/login/oauth/access_token";

// 前端喺 GitHub Pages 跨域 fetch 本 worker,冇 CORS header 會被瀏覽器擋 (fetch 報 Failed to fetch)
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS }
  });
}

function htmlError(status, message) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>同步出錯</title><p>${message}</p>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function isAllowedReturn(raw, allowedPrefixes) {
  if (typeof raw !== "string" || !raw) return false;
  return allowedPrefixes.some((prefix) => raw.startsWith(prefix));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    // 前端拿 client_id 用 (client_id 屬公開信息)
    if (url.pathname === "/api/config") {
      return json({ clientId: env.GITHUB_CLIENT_ID || "" });
    }

    if (url.pathname === "/auth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";
      const allowed = (env.ALLOWED_RETURN_PREFIXES || "").split(",").map((s) => s.trim()).filter(Boolean);
      const fallback = env.DEFAULT_RETURN || "";

      if (!code) {
        return htmlError(400, "缺少 code。請回到練習頁重新登入。");
      }
      const returnTo = isAllowedReturn(state, allowed) ? state : fallback;
      if (!returnTo) {
        return htmlError(400, "回跳地址不合法或未設定 ALLOWED_RETURN_PREFIXES。");
      }

      let token;
      try {
        const resp = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: url.origin + "/auth/callback"
          })
        });
        const data = await resp.json();
        token = data && data.access_token;
        if (!token) {
          return htmlError(502, "GitHub 換 token 失敗：" + JSON.stringify(data).slice(0, 200));
        }
      } catch (e) {
        return htmlError(502, "換 token 時出錯：" + (e && e.message ? e.message : String(e)));
      }

      const joiner = returnTo.includes("#") ? "&" : "#";
      return Response.redirect(returnTo + joiner + "sync_token=" + encodeURIComponent(token), 302);
    }

    return json({ error: "not found" }, 404);
  }
};

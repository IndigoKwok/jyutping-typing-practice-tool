# 雲端同步部署教學（GitHub OAuth + Cloudflare Workers + 私有 Gist）

一次過照做就得，約 15 分鐘。需要：GitHub 帳號、Cloudflare 帳號（免費）。

## 原理

- 學習記錄存喺**你嘅私有 Gist**（`jyutping-stats.json`），只有你自己睇到
- `client_secret` 放喺 Cloudflare Worker 環境變量，前端見唔到
- 你嘅 GitHub token 存喺自己瀏覽器 localStorage，用来直接讀寫 Gist

## 第 1 步：部署 Worker

```powershell
cd workers
npx wrangler login          # 會彈瀏覽器俾你授權 Cloudflare
npx wrangler deploy         # 部署成功會話你知網址，形如:
                            # https://jyutping-sync.<你的子域>.workers.dev
```

## 第 2 步：建 GitHub OAuth App

去 https://github.com/settings/developers → OAuth Apps → New OAuth App：

- Application name：`粵拼打字練習同步`（隨意）
- Homepage URL：`https://indigokwok.github.io/jyutping-typing-practice-tool/`
- Authorization callback URL：`https://jyutping-sync.<你的子域>.workers.dev/auth/callback`
  （即係第 1 步個網址 + `/auth/callback`）

建完會見到 **Client ID**（公開）;點 Generate a new client secret 拎 **Client Secret**。

## 第 3 步：設定 Worker 環境

```powershell
# 改 workers/wrangler.toml 入面 GITHUB_CLIENT_ID = "你的_CLIENT_ID"
npx wrangler secret put GITHUB_CLIENT_SECRET   # 貼上 secret,唔會寫入任何文件
npx wrangler deploy                             # 重新部署令 vars 生效
```

## 第 4 步：前端指向 Worker

改 `app/app.js` 開頭附近嘅同步設定：

```js
const SYNC_WORKER_BASE = "https://jyutping-sync.<你的子域>.workers.dev";
```

push 上 GitHub，等 Pages 更新。

## 第 5 步：用

打開練習頁 → 右上齒輪「設定」→「雲端同步」→「用 GitHub 登入」→ 授權後自動跳返，
程式會搵（或者整）你嘅私有 Gist，然後按情況同步：

- 新機沒記錄 → 自動拉雲端落嚟
- 兩邊都有記錄 → 彈窗問你留邊邊
- 之後每次練習會自動上傳（3 秒防抖）
- 授權範圍只有 `gist`,程式掂唔到你啲 repo

## 檢查清單

- [ ] `https://jyutping-sync.<子域>.workers.dev/health` 回 `{"ok":true}`
- [ ] `/api/config` 回你嘅 clientId
- [ ] 設定頁「雲端同步」見到「用 GitHub 登入」
- [ ] 登入後 gist.github.com 見到 `jyutping-stats.json`

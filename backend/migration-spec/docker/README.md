# Docker 規格說明

這個資料夾是**未來 Node.js 專案**的 Docker 參考範本，不是可以在目前 `src/`（Laravel 專案）直接
執行的東西——`Dockerfile` 假設有 `package.json`、`npm run build`/`dev`、`dist/` 等在 Node 專案建立
後才會存在的產物。

## 需求對應

- **Node.js 22 以上**：`Dockerfile` `ARG NODE_VERSION=22-alpine`。
- **Multi-stage build**：`deps` → `build` → `prod-deps` → `production`（另有 `development` stage 供本機開發）。
- **非 root user**：`production`/`development` stage 都建立並切換到 `app` 這個非特權使用者。
- **Production 與 Development 可區分**：`docker build --target production` / `--target development`；
  `docker-compose.yml` 預設用 `target: development` 做本機開發（含 volume mount 支援熱重載）。
- **Healthcheck**：`Dockerfile` 內建 `HEALTHCHECK`（呼叫 `dist/healthcheck.js`，Node 專案需自行實作一個
  會檢查 DB 連線 + 回傳 exit code 0/1 的小腳本）；`docker-compose.yml` 的 `mysql` service 也有
  `healthcheck`，`api` service 用 `depends_on: condition: service_healthy` 等它就緒才啟動。
- **API container**：`api` service。
- **與正式環境相同類型及盡量相同版本的 SQL container**：`mysql:8.0.33`——**已用 `SELECT VERSION();`
  對正式 Zeabur 資料庫做唯讀查詢確認**，本機版本與正式環境完全一致，不是用「最新的 8」這種
  模糊版本。
- **Volume 保存本機資料**：`mysql_data`、`redis_data` 具名 volume。
- **Migration / verify / test / dev / production 指令**：見下方。

## 本機指令（對應 `改版.md` 要求）

```bash
docker compose up -d
docker compose exec api npm run db:migrate   # 執行 migration-spec/node-migrations/migrate.ts
docker compose exec api npm run db:verify    # 唯讀比對 schema，見 node-migrations/verify.ts
docker compose exec api npm test             # Vitest
```

Node 專案的 `package.json` 預期會有這些 script（本規格文件不建立實際的 `package.json`，因為
Node 專案本身尚未建立）：

```jsonc
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "db:migrate": "tsx node-migrations/migrate.ts",
    "db:verify": "tsx node-migrations/verify.ts",
    "test": "vitest run"
  }
}
```

## 為什麼不直接把資料庫密碼放進這些檔案

- `.env.example` 全部是佔位值（`change_me`），**不可**貼上任何真實帳密。
- 正式環境（Zeabur）的環境變數在 Zeabur 平台的專案設定內管理，不進版本控制。
- 本次分析為了驗證 schema，曾經以唯讀方式連線過正式資料庫，**連線帳密沒有被寫入本專案任何檔案**
  （包含這裡的 docker 範本）。

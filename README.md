# jinfeng-monorepo

金豐集團專案的 monorepo,整合前後端為單一 repository,各自以獨立 Zeabur Service 部署。

## Repository structure

```text
jinfeng-monorepo/
├── frontend/          # Nuxt 3 前端(見 frontend/README.md)
├── backend/           # Express 後端(見 backend/README.md)
├── specs/
│   ├── frontend/      # 純前端規格(SEO、UI、資源優化)
│   ├── backend/       # 純後端規格(auth-login 實作規格、migration 歷史文件)
│   └── shared/        # 前後端共同 API contract
├── skills/
│   ├── frontend/
│   ├── backend/
│   └── shared/
└── CLAUDE.md          # monorepo 全域 AI 開發規則
```

## 技術棧

**Frontend**(`frontend/`)

- Nuxt 3(SSR)+ Vue 3 + TypeScript
- Tailwind CSS、Nuxt UI、Pinia
- Node.js + npm(`legacy-peer-deps=true`)

**Backend**(`backend/`)

- Node.js ≥22 + Express 5 + TypeScript(strict)
- mysql2、Zod、JWT、Pino、Helmet
- Vitest、OpenAPI 3.1 validation
- Docker / Docker Compose

## 開發指令

各自在對應子目錄安裝與執行,兩邊獨立管理 `package-lock.json`,尚未使用 npm workspaces。

```bash
# frontend
cd frontend
npm ci
npm run dev      # http://localhost:3000
npm run build

# backend
cd backend
npm ci
npm run dev              # http://localhost:8080
npm run build
npm test
npm run typecheck
npm run lint
npm run openapi:validate
```

也可以在根目錄使用 proxy scripts(見根 `package.json`):

```bash
npm run dev:frontend
npm run dev:backend
npm run build:frontend
npm run build:backend
```

## Deployment(Zeabur)

Monorepo 使用兩個獨立 Zeabur Service,共用同一個 GitHub repository:

| Service | Root Directory |
|---|---|
| Frontend | `frontend` |
| Backend | `backend` |

- Backend 使用現有 `backend/Dockerfile` 部署
- Frontend 目前未建立 Dockerfile,是否採用 Zeabur Nuxt 自動偵測或另建 Dockerfile,留待後續獨立任務決定
- 前後端不合併進同一個容器

## 開發前必讀

修改任一邊程式碼前,請先閱讀 `CLAUDE.md` 與對應的 `specs/`、`skills/` 目錄。

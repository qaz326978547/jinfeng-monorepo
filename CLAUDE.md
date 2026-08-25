# Jinfeng Monorepo — Claude Instructions

## Repository structure

```text
frontend/
backend/
specs/frontend/
specs/backend/
specs/shared/
skills/frontend/
skills/backend/
skills/shared/
```

## Frontend task

修改 frontend 前優先閱讀：

```text
specs/frontend/
skills/frontend/
```

若涉及 API，再讀：

```text
specs/shared/
```

## Backend task

修改 backend 前優先閱讀：

```text
specs/backend/
skills/backend/
```

若涉及 API，再讀：

```text
specs/shared/
```

## Full-stack task

若需求同時影響前後端：

- 同時檢查 frontend / backend
- API schema 必須保持一致
- 更新 shared API contract
- 前後端測試都必須執行

## Security

- 不提交 `.env`
- 不輸出 production secrets
- 不修改正式憑證
- 不執行破壞性正式 DB 指令

## Deployment

- monorepo 使用兩個 Zeabur Service
- frontend Root Directory = `frontend`
- backend Root Directory = `backend`
- 不將 frontend/backend 合成單一容器

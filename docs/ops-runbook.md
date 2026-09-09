# 老街品牌局运行与恢复手册

## 环境与启动

生产环境必须设置 `DATABASE_URL`、`CORS_ORIGINS`、`NODE_ENV=production`、`PORT` 和 `HOST`。正式 Pages 入口还必须指向 V11 API；仓库的 `runtime-config.js` 已为 `https://branding-game.pages.dev` 提供 Railway API 的公开兜底地址，部署平台的 `VITE_V11_API_BASE` 可以覆盖它。`CORS_ORIGINS` 至少包含 `https://branding-game.pages.dev`，不要使用通配符。应用启动前执行迁移，应用进程不自动改表：

```powershell
$env:DATABASE_URL = 'postgres://...'
pnpm db:migrate
pnpm release:build
pnpm release:smoke
pnpm --filter @laojie/api start:v11
```

`release:build` 会先构建 workspace，再准备包含编译 workspace 包和 `v1.4.0` 正式内容的 API 运行目录；`release:smoke` 会用纯 Node 启动该编译入口并校验 `/ready` 的内容版本与校验和；`start:v11` 是正式 v1.4 API 的非 watch 启动入口，`dev:v11` 只用于本地开发。启动前仍必须完成迁移，并设置生产数据库、密钥、HTTPS 反向代理和明确的 `CORS_ORIGINS`。

需要容器化时执行 `pnpm image:build`，它使用固定 Node 基础镜像构建 `Dockerfile.api`；镜像内的健康检查使用 `/ready`，数据库和 `SEED_ENCRYPTION_KEY` 仍必须由部署平台注入，不能写进镜像。

教师账号密码不写入仓库或日志。内容包发布前执行 `pnpm content:validate` 与 `pnpm content:compile`，并保存编译输出中的 SHA-256。

## 本地 PostgreSQL

若 Docker 可用，仓库根目录的 `compose.yaml` 提供 PostgreSQL 18 临时实例。执行 `pnpm db:local:up` 启动，设置本地 `DATABASE_URL` 后运行 `pnpm db:migrate` 和 `pnpm db:seed:test`；完成后执行 `pnpm db:local:down`。该配置只用于开发和恢复演练，不作为生产数据库部署方案。

## 每日备份

`scripts/backup.mjs` 使用 `pg_dump --format=custom` 生成数据库备份，并在同目录写入包含内容版本和校验和的 manifest。备份目录不得通过 Web 服务暴露：

```powershell
$env:DATABASE_URL = 'postgres://...'
$env:BACKUP_DIR = 'D:\backups\laojie'
node scripts/backup.mjs
```

备份脚本默认随当前发布候选归档 `content/compiled/v1.4.0.json`；若备份历史版本，需同时设置 `CONTENT_VERSION` 和对应的 `CONTENT_FILE`，脚本会在执行 `pg_dump` 前拒绝版本不匹配的内容包。manifest 中的 `contentChecksum` 必须与该文件的 SHA-256 一致。

建议每日一次数据库备份、每次内容发布单独归档内容包；保留期暂按 `PRIVACY.md` 的课程负责人确认值执行，默认建议 12 个月。整班删除后，在线库和到期备份都必须按同一保留策略清理。

## 恢复演练

恢复只能指向临时数据库，必须显式确认，不允许把未核对的备份直接恢复到生产：

```powershell
$env:RESTORE_DATABASE_URL = 'postgres://...temporary...'
$env:BACKUP_FILE = 'D:\backups\laojie\laojie-....dump'
$env:CONFIRM_RESTORE = 'YES'
node scripts/restore.mjs
pnpm db:migrate
```

恢复脚本默认用 `content/compiled/v1.4.0.json` 校验备份 manifest；恢复历史版本时必须同时设置 `CONTENT_VERSION` 和 `CONTENT_FILE`。在执行 `pg_restore` 前，版本或 SHA-256 任一不匹配都会停止，不会写入临时数据库。

恢复后随机抽取学生的决策日志，以固定内容包重放，并比较 `state_hash`；同时核对 manifest 中的 `contentVersion` 和 `contentChecksum`。若哈希不一致，停止发布并保留临时库供排查，不覆盖原备份。

## 发布与回滚

发布顺序为：备份 → 迁移 → 内容校验 → API 冒烟 → Web 构建 → 观察健康检查。回滚只回滚应用构建，不回滚追加式学生日志；若迁移已执行，使用前向补偿迁移处理，不删除历史迁移。

API 日志只允许使用请求 ID、班级内部 ID、playthrough ID 和动作序号定位问题，不写姓名、学号和自由文本。`/health` 只表示进程存活；上线前和负载均衡器应检查 `/ready`，它会验证数据库连接并返回已加载内容版本/校验和。异常时优先查看请求 ID、动作序号和数据库连接状态。

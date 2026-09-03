# 老街品牌局

屯溪老街茶饮品牌经营教学游戏：学生手机端独立完成 12 回合品牌经营决策，系统按固定内容包和确定性规则生成因果报告；教师端查看首局聚合、实名时间线、匿名案例和 CSV。

## 本地开发

需要 Node.js 24 和 pnpm 11。安装依赖后：

```powershell
pnpm install
pnpm content:validate
pnpm content:compile
pnpm dev
```

Windows 用户也可以双击项目根目录的 `start-game.cmd`。启动后打开：

`http://127.0.0.1:4173/`

要运行 v1.2 正式学生入口，还需在第二个终端启动 v1.2 API：

```powershell
pnpm start:v11
```

然后打开 `http://127.0.0.1:4173/v11`。该入口的每个动作都由 v1.2 API 结算并保存；`/v11-full` 是不依赖 API 的本地 UI 预览，不用于正式收集学生数据。

教师后台：

`http://127.0.0.1:4173/v11-teacher`

登录 v1.2 教师后台后，可以创建绑定当前 `v1.2.0` 内容包的新班级、复制班级码、切换班级并关闭不再开放的班级；生产后台不提供内容、权重、种子或学生结果编辑入口。

如果需要让同一局域网内的学生手机访问，双击 `start-game-lan.cmd`。脚本会先构建当前 v1.2 前端和 API 运行产物，再启动非 watch 的服务；在教师电脑执行 `ipconfig` 找到 IPv4 地址，然后让学生访问 `http://教师电脑IPv4地址:4180/v11`。Windows 防火墙需要允许 Node.js 访问专用网络；不要在公共网络使用这个临时模式。

默认旧版 API 为 `http://127.0.0.1:3000`，v1.2 API 为 `http://127.0.0.1:3001`，学生端为 Vite 地址；局域网脚本会把学生端固定到 `:4180/v11`，并把 v1.2 API 固定到 `:3002`。v1.2 试运行班级码默认为 `LAOJIE11`；正式部署时应通过环境变量和班级种子创建真实班级。教师测试账号为 `teacher@example.test / change-me-in-production`，只用于本地测试，正式环境必须通过数据库种子和秘密管理设置新密码。

## PostgreSQL

生产环境必须设置 `DATABASE_URL` 和 32 字节 `SEED_ENCRYPTION_KEY`；配置数据库后 API 自动使用 `PostgresStore`，未配置数据库的 MemoryStore 只用于本地开发和测试。迁移与测试种子：

本地若已安装 Docker，可用仓库内的 PostgreSQL 18 配置启动临时数据库：

```powershell
pnpm db:local:up
$env:DATABASE_URL = 'postgres://laojie:change-me-local-only@127.0.0.1:5432/laojie'
$env:SEED_ENCRYPTION_KEY = '替换为64位十六进制字符串'
pnpm db:migrate
pnpm db:seed:test
```

完成迁移演练后执行 `pnpm db:local:down` 停止容器；该命令保留本地卷，若要清除本地数据库需由操作者明确执行 Docker 的卷清理命令。

迁移不会自动回滚学生日志。发布内容后不原位修改版本，修正需要新内容版本和新班级。

## 验收命令

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:load
pnpm game:simulate
pnpm content:validate
pnpm content:compile
```

`pnpm test:e2e` 会自动托管并回收本地 API、V11 API 与静态服务；如需只跑移动端，可执行 `pnpm test:mobile`。

候选发布还需生成并验证可启动的 API 运行目录：

```powershell
pnpm release:build
pnpm release:smoke
pnpm assets:check:v11
pnpm assets:audit:v18
pnpm pilot:preflight
pnpm image:build
```

`release:smoke` 会检查 `/ready`、内容版本和内容校验和；`image:build` 需要在已安装 Docker 的目标环境执行。

备份、恢复和发布验收流程见 [docs/ops-runbook.md](/E:/codex%20program/07%20course%20game/docs/ops-runbook.md)、[docs/v1.2-发布候选验收包.md](/E:/codex%20program/07%20course%20game/docs/v1.2-%E5%8F%91%E5%B8%83%E5%80%99%E9%80%89%E9%AA%8C%E6%94%B6%E5%8C%85.md) 与 [docs/v1.2-人工发布验收记录.md](/E:/codex%20program/07%20course%20game/docs/v1.2-%E4%BA%BA%E5%B7%A5%E5%8F%91%E5%B8%83%E9%AA%8C%E6%94%B6%E8%AE%B0%E5%BD%95.md)。

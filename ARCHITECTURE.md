# Architecture baseline

## Runtime

- Node.js 24 LTS
- React 19 + Vite 8
- Fastify API
- PostgreSQL 18
- TypeScript strict

## Trust boundary

学生端可以预览状态，但服务端使用已发布内容包和动作日志重放正式结果。客户端提交的状态、结局、报告和指标均不可信。

## Content lifecycle

`draft -> reviewed -> published -> retired`

`published` 版本不得原位修改。修正内容创建新版本，并只对新建班级可用。运行中的服务必须只读保留仍有班级绑定的历史内容包；学生恢复、动作结算、报告和教师分析均按班级绑定的精确版本与校验和路由，不能用当前版本覆盖旧班级。

## Reproducibility

正式结果由内容版本、引擎版本、班级种子、单局派生种子和动作序列决定。状态快照是可重建缓存，追加式决策日志是审计依据。

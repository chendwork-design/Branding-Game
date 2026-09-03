# ADR-0001：确定性本地优先课程游戏

## 状态

Accepted

## 决策

使用 React/Vite 学生与教师 Web 界面、Fastify API、PostgreSQL、纯 TypeScript 规则引擎、追加式动作日志和 IndexedDB outbox。

## 原因

需要手机可玩、弱网可续玩、首局不可篡改、结果可重放、教师可查看完整决策过程，同时保持轻量页游工程体量。

## 后果

规则和内容必须结构化；服务端必须重放；离线结果在联网前只能标注为本机预览；教师后台不具备 CMS 能力。

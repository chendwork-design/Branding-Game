# 《老街品牌局》v1.1 需求追踪表

> 状态说明：`自动化已实现，待人工/发布门禁` 表示代码和自动化证据已经具备，但仍需要真人试玩、课程负责人审校或真实生产环境验证；`待真人` 不等于已完成。  
> 当前基线：2026-08-27，目标版本 `v1.1.0`。  
> 施工细节：见 `建设规格-PRD-v1.1遗漏补全.md`。

| 需求 ID | 任务           | 当前状态                     | 验收证据/测试位置                                                                                              |
| ------- | -------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| LOOP-01 | M10-02、M10-06 | M10-已实现                   | `apps/web/e2e/v11-slice.spec.ts`、`apps/api/tests/v11-slice.test.ts`                                           |
| LOOP-02 | M10-02、M11-08 | M11-已实现                   | `packages/game-engine/tests/v11-simulation.test.ts`（10,000 局）                                               |
| LOOP-03 | M11-03、M13-01 | M13-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`、`packages/content-schema/tests/v11-full-coverage.test.ts`    |
| LOOP-04 | M10-06、M13-07 | M13-已实现（占位资产可降级） | `apps/web/e2e/v11-m13-full-content.spec.ts`、`apps/web/src/v11App.tsx`                                         |
| LOOP-05 | M13-01、M15-01 | 待真人辨识试玩               | `docs/content-review-v11.md`、`docs/pilot-checklist.md`                                                        |
| FTUE-01 | M10-01         | 自动化已实现，待真人门禁     | `apps/web/e2e/v11-slice.spec.ts`、`docs/playtest-v11-slice.md`                                                 |
| FTUE-02 | M10-01、M12-08 | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`、`apps/web/src/v11StudentFlow.ts`                                            |
| WIN-01  | M10-01、M12-02 | 自动化已实现，待理解访谈     | `apps/web/src/v11App.tsx`、`docs/content-review-v11.md`                                                        |
| WIN-02  | M11-06、M11-08 | M11/M13-已实现               | `packages/game-engine/tests/v11-scoring.test.ts`、`scripts/v11-release-check.ts`                               |
| WIN-03  | M14-05         | M14-已实现                   | `apps/api/tests/v11-analytics.test.ts`、`apps/web/src/v11Teacher.tsx`                                          |
| RES-01  | M9-03、M11-02  | M11-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`                                                               |
| RES-02  | M9-03、M13-01  | M13-已实现                   | `packages/content-schema/tests/v11-full-coverage.test.ts`                                                      |
| RES-03  | M10-02、M11-02 | M11-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`                                                               |
| RES-04  | M11-01         | M11-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`                                                               |
| RES-05  | M11-02         | M11-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`                                                               |
| RES-06  | M13-03         | M13-已实现，待课程负责人审校 | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| EVI-01  | M13-02         | M13-已实现                   | `packages/content-schema/tests/v11-full-coverage.test.ts`                                                      |
| EVI-02  | M10-03         | M10-已实现                   | `apps/web/e2e/v11-slice.spec.ts`                                                                               |
| EVI-03  | M11-03         | M11-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`                                                               |
| EVI-04  | M10-03、M12-03 | M10-已实现                   | `apps/web/src/v11App.tsx`、`packages/content-schema/src/v11-slice.ts`                                          |
| EVI-05  | M14-01         | M14-已实现                   | `packages/report-engine/tests/v11-slice-report.test.ts`                                                        |
| CHO-01  | M13-01         | 自动化已实现，待人工内容评审 | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| CHO-02  | M10-05         | M10-已实现                   | `apps/web/src/v11StudentFlow.test.ts`、`packages/game-engine/tests/v11-vertical-slice.test.ts`                 |
| CHO-03  | M12-03         | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`                                                                              |
| CHO-04  | M12-03、M13-01 | M12/M13-已实现               | `packages/game-engine/tests/v11-economy.test.ts`、`apps/web/e2e/v11-m13-full-content.spec.ts`                  |
| CHO-05  | M11-08         | M11-已实现                   | `packages/game-engine/tests/v11-simulation.test.ts`                                                            |
| RISK-01 | M10-04、M11-04 | M11-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`                                                               |
| RISK-02 | M10-04、M10-05 | M10-已实现                   | `apps/api/tests/v11-slice.test.ts`                                                                             |
| RISK-03 | M10-10         | 待真人试玩时长记录           | `docs/playtest-v11-slice.md`                                                                                   |
| RISK-04 | M10-08、M14-01 | M14-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`、`packages/report-engine/tests/v11-slice-report.test.ts`      |
| FB-01   | M10-06         | M10-已实现                   | `packages/game-engine/tests/v11-vertical-slice.test.ts`、`apps/web/e2e/v11-slice.spec.ts`                      |
| FB-02   | M10-06、M14-01 | M14-已实现                   | `packages/report-engine/tests/v11-slice-report.test.ts`                                                        |
| FB-03   | M10-08、M11-03 | M13-已实现                   | `packages/game-engine/tests/v11-economy.test.ts`、`packages/content-schema/tests/v11-full-coverage.test.ts`    |
| FB-04   | M10-06、M13-07 | M13-已实现                   | `apps/web/public/assets/v11/asset-placeholder.svg`、`apps/web/e2e/v11-m13-full-content.spec.ts`                |
| FB-05   | M12-06、M12-08 | M12-已实现，待真机性能记录   | `apps/web/e2e/v11-m12-ui.spec.ts`、`apps/web/src/styles.css`                                                   |
| HUD-01  | M12-02         | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`                                                                              |
| HUD-02  | M12-02         | M12-已实现                   | `apps/web/src/v11App.tsx`、`v11-m12-ui.spec.ts`                                                                |
| HUD-03  | M12-02         | M12-已实现                   | `apps/web/src/v11StudentFlow.ts`、`v11StudentFlow.test.ts`                                                     |
| HUD-04  | M12-02         | M12/M13-已实现               | `apps/web/src/v11App.tsx`、`packages/game-engine/tests/v11-economy.test.ts`                                    |
| REW-01  | M11-05         | M13-已实现                   | `packages/content-schema/tests/v11-full-coverage.test.ts`、`packages/game-engine/src/v11-runtime.ts`           |
| REW-02  | M10-08、M14-01 | M14-已实现                   | `apps/web/e2e/v11-slice.spec.ts`、`packages/report-engine/tests/v11-slice-report.test.ts`                      |
| REW-03  | M12-05、M13-07 | M13-已实现，待真人路线观察   | `packages/game-engine/tests/v11-scoring.test.ts`、`scripts/v11-release-check.ts`                               |
| END-01  | M11-06         | M11-已实现                   | `packages/game-engine/tests/v11-scoring.test.ts`                                                               |
| END-02  | M11-06、M14-01 | M14-已实现                   | `packages/game-engine/tests/v11-scoring.test.ts`、`packages/report-engine/tests/v11-slice-report.test.ts`      |
| COPY-01 | M13-01、M13-08 | 自动化已实现，待中文终审     | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| COPY-02 | M13-01         | 自动化已实现，待真人复述     | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| COPY-03 | M13-05         | 待真人理解测试               | `docs/content-review-v11.md`                                                                                   |
| CHAR-01 | M13-05         | M13-已实现，待人工审校       | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| VIS-01  | M11-07         | M11-已实现                   | `packages/game-engine/tests/v11-scoring.test.ts`、`packages/game-engine/src/v11-runtime.ts`                    |
| VIS-02  | M11-08         | M13-已实现                   | `packages/game-engine/tests/v11-simulation.test.ts`、`packages/content-schema/tests/v11-full-coverage.test.ts` |
| VIS-03  | M12-04         | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`、`apps/web/e2e/v11-m13-full-content.spec.ts`                                 |
| VIS-04  | M13-07         | M13-已实现                   | `apps/web/public/assets/v11/asset-placeholder.svg`、`packages/content-schema/tests/v11-full-coverage.test.ts`  |
| VIS-05  | M12-06、M15-03 | 自动化已实现，待真机性能     | `apps/web/src/styles.css`、`docs/v1.1-release-candidate-report.md`                                             |
| UI-01   | M12-01、M12-03 | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`                                                                              |
| UI-02   | M12-07         | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`、`apps/web/src/styles.css`                                                   |
| UI-03   | M12-08         | M12-已实现                   | `apps/web/src/v11App.tsx`、`v11-m12-ui.spec.ts`                                                                |
| UI-04   | M12-07         | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`                                                                              |
| UI-05   | M12-08         | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`、`apps/web/src/v11App.tsx`                                                   |
| UI-06   | M12-03、M12-07 | M12-已实现                   | `apps/web/e2e/v11-m12-ui.spec.ts`                                                                              |
| REP-01  | M14-01、M14-02 | M14-已实现                   | `packages/report-engine/tests/v11-slice-report.test.ts`                                                        |
| REP-02  | M14-01         | M14-已实现                   | `packages/report-engine/tests/v11-slice-report.test.ts`、`apps/api/tests/v11-analytics.test.ts`                |
| REP-03  | M9-07          | M9-已实现                    | `packages/report-engine/tests/v11-contract.test.ts`                                                            |
| TCH-01  | M14-03         | M14-已实现                   | `apps/api/tests/v11-analytics.test.ts`、`apps/web/e2e/v11-m14-teacher.spec.ts`                                 |
| TCH-02  | M14-05         | M14-已实现                   | `apps/api/tests/v11-analytics.test.ts`、`apps/web/src/v11Teacher.tsx`                                          |
| ENG-01  | M9-04、M11-08  | M9-已实现                    | `packages/game-engine/tests/v11-contract.test.ts`、`scripts/v11-release-check.ts`                              |
| ENG-02  | M9-04          | M9-已实现                    | `packages/shared-contracts/tests/v11-contract.test.ts`                                                         |
| ENG-03  | M9-02、M9-07   | M9-已实现                    | 版本路由契约测试                                                                                               |
| ENG-04  | M9-03、M11-05  | M11-已实现                   | `packages/content-schema/tests/v11-slice-coverage.test.ts`                                                     |
| DATA-01 | M9-05、M10-05  | M9-已实现                    | `apps/api/tests/db-contract.test.ts`、`apps/api/tests/load/v11-flow.test.ts`                                   |
| DATA-02 | M12-09         | M12-已实现                   | `apps/web/src/v11StudentFlow.ts`、`apps/web/src/v11Persistence.test.ts`                                        |
| CNT-01  | M13-01         | 自动化已实现，待人工内容评审 | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| CNT-02  | M13-04         | M13-已实现                   | `packages/content-schema/tests/v11-full-coverage.test.ts`、`packages/game-engine/tests/v11-events.test.ts`     |
| CNT-03  | M13-08         | M13-已实现                   | `packages/content-schema/tests/v11-full-coverage.test.ts`、`packages/content-schema/src/compile-v11.ts`        |
| CNT-04  | M13-08         | 自动化已实现，待人工词汇终审 | `packages/content-schema/tests/v11-full-coverage.test.ts`、`docs/content-review-v11.md`                        |
| CNT-05  | M13-05         | 待课程负责人现实因果审查     | `docs/content-review-v11.md`                                                                                   |
| NFR-01  | M15-02         | 自动化已实现，待发布环境演练 | `apps/api/tests/load/v11-flow.test.ts`、`docs/v1.1-release-candidate-report.md`                                |
| NFR-02  | M12-09、M15-04 | M12-已实现待弱网演练         | `apps/web/src/v11Persistence.ts`、`v11Persistence.test.ts`、`v11-m12-ui.spec.ts`                               |
| NFR-03  | M15-03         | 浏览器仿真已实现，待真实设备 | `apps/web/e2e` Chromium/WebKit 矩阵、`docs/v1.1-release-candidate-report.md`                                   |
| NFR-04  | M13-07、M15-03 | 自动化已实现，待真实设备性能 | `apps/web/static-server.mjs`、`docs/v1.1-release-candidate-report.md`                                          |

## 变更登记规则

- 每次代码提交只对应一个任务 ID；
- 状态只有在对应测试、文档和验收证据齐全后才能改为“完成”；
- Schema、规则、内容和数据库变更必须同时更新相关测试；
- 版本历史、首局日志和教师只读约束不得被追踪表更新过程破坏。

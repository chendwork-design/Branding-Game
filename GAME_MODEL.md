# Game model contract

## Visible state

- cash: 现金/存活资源
- awareness: 知名度
- conversion: 购买转化
- trust: 信任
- loyalty: 忠诚/社区
- actionPoints: 注意力/行动点

## Hidden state

- segmentFit
- differentiation
- brandConsistency
- promiseCredibility
- productDelivery
- orgCapacity
- culturalCredibility
- visualRecognition
- visualAdaptability
- channelDependence
- reputationDebt

## Action types

`evidence_viewed`, `choice_previewed`, `intent_selected`, `risk_selected`, `choice_selected`, `visual_selected`, `visual_revised`, `visual_tested`。

## Effect timing

每个效果必须标注 `immediate` 或 `delayed`，并带 `sourceDecisionId`。隐藏状态不能直接以数值展示给学生，只能通过反馈和报告解释。

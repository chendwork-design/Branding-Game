# Data model contract

核心对象：教师、班级、学生身份、单局、决策、证据查看、视觉选择、事件、状态快照、结局、报告、反思、内容版本和埋点事件。

班级一旦开始游戏，`contentVersionId` 和 `seed` 不可更新。班级内每名学生只能有一个首局；重玩单独记录。

历史决策只允许追加。整班生命周期删除是受控的数据清除，不得选择性修改某位学生的历史结果。

PostgreSQL 是生产 canonical store；`student_sessions` 只保存 token hash，班级种子以 AES-256-GCM 密文保存，客户端只接收单局派生种子。`playthroughs` 保存状态快照、状态哈希、报告和报告阅读元数据，`decision_logs` 以 `(playthrough_id, sequence_no)` 与幂等键双重约束追加写入。

数据库迁移 `0003_first_run_constraint` 保证每个学生只有一个 `first_run`，允许多个 `replay`；`0004_immutable_published_data` 在数据库层阻止已发布内容版本、班级内容版本和班级种子被修改。

import {
  boolean,
  jsonb,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const teachers = pgTable('teachers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const contentVersions = pgTable('content_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  version: text('version').notNull().unique(),
  engineVersion: text('engine_version').notNull(),
  checksum: text('checksum').notNull().unique(),
  status: text('status').notNull(),
  contentJson: jsonb('content_json').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const classes = pgTable('classes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  contentVersionId: uuid('content_version_id')
    .notNull()
    .references(() => contentVersions.id),
  seedCiphertext: text('seed_ciphertext').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const studentIdentities = pgTable(
  'student_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentNumber: text('student_number').notNull(),
    normalizedStudentNumber: text('normalized_student_number').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classStudentNumber: uniqueIndex('student_class_number_idx').on(
      table.classId,
      table.normalizedStudentNumber,
    ),
  }),
);

export const playthroughs = pgTable('playthroughs', {
  id: uuid('id').defaultRandom().primaryKey(),
  classId: uuid('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  studentIdentityId: uuid('student_identity_id')
    .notNull()
    .references(() => studentIdentities.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('active'),
  stateJson: jsonb('state_json').notNull(),
  stateHash: text('state_hash').notNull(),
  reportJson: jsonb('report_json'),
  reflectionJson: jsonb('reflection_json'),
  reportViewedAt: timestamp('report_viewed_at', { withTimezone: true }),
  reportReadDepth: integer('report_read_depth').default(0).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const decisionLogs = pgTable('decision_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  playthroughId: uuid('playthrough_id')
    .notNull()
    .references(() => playthroughs.id, { onDelete: 'cascade' }),
  sequenceNo: integer('sequence_no').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  actionHash: text('action_hash'),
  actionJson: jsonb('action_json').notNull(),
  traceJson: jsonb('trace_json').notNull(),
  stateHash: text('state_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evidenceViews = pgTable(
  'evidence_views',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull(),
    evidenceId: text('evidence_id').notNull(),
    cost: integer('cost').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthroughEvidence: uniqueIndex('evidence_views_playthrough_evidence_idx').on(
      table.playthroughId,
      table.evidenceId,
    ),
    playthroughSequence: uniqueIndex('evidence_views_playthrough_sequence_idx').on(
      table.playthroughId,
      table.sequenceNo,
    ),
  }),
);

export const visualChoices = pgTable(
  'visual_choices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull(),
    visualId: text('visual_id').notNull(),
    revisionText: text('revision_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthroughSequence: uniqueIndex('visual_choices_playthrough_sequence_idx').on(
      table.playthroughId,
      table.sequenceNo,
    ),
  }),
);

export const gameEvents = pgTable(
  'game_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull(),
    eventId: text('event_id').notNull(),
    classWide: boolean('class_wide').notNull(),
    traceJson: jsonb('trace_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthroughEvent: uniqueIndex('game_events_playthrough_event_idx').on(
      table.playthroughId,
      table.eventId,
    ),
  }),
);

export const stateSnapshots = pgTable(
  'state_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    sequenceNo: integer('sequence_no').notNull(),
    stateJson: jsonb('state_json').notNull(),
    stateHash: text('state_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthroughSequence: uniqueIndex('state_snapshots_playthrough_sequence_idx').on(
      table.playthroughId,
      table.sequenceNo,
    ),
    playthroughHash: uniqueIndex('state_snapshots_playthrough_hash_idx').on(
      table.playthroughId,
      table.stateHash,
    ),
  }),
);

export const endings = pgTable(
  'endings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    endingId: text('ending_id').notNull(),
    stateHash: text('state_hash').notNull(),
    endingJson: jsonb('ending_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthrough: uniqueIndex('endings_playthrough_idx').on(table.playthroughId),
  }),
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    stateHash: text('state_hash').notNull(),
    reportJson: jsonb('report_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthrough: uniqueIndex('reports_playthrough_idx').on(table.playthroughId),
  }),
);

export const reflections = pgTable(
  'reflections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthroughRevision: uniqueIndex('reflections_playthrough_revision_idx').on(
      table.playthroughId,
      table.revision,
    ),
  }),
);

export const syncReceipts = pgTable(
  'sync_receipts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playthroughId: uuid('playthrough_id')
      .notNull()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull(),
    sequenceNo: integer('sequence_no'),
    status: text('status').notNull(),
    responseJson: jsonb('response_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playthroughKey: uniqueIndex('sync_receipts_playthrough_key_idx').on(
      table.playthroughId,
      table.idempotencyKey,
    ),
  }),
);

export const playthroughProtocols = pgTable(
  'playthrough_protocols',
  {
    playthroughId: uuid('playthrough_id')
      .primaryKey()
      .references(() => playthroughs.id, { onDelete: 'cascade' }),
    protocolVersion: text('protocol_version').notNull(),
    engineVersion: text('engine_version').notNull(),
    reportVersion: text('report_version').notNull(),
    contentVersion: text('content_version').notNull(),
    contentChecksum: text('content_checksum').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    contentVersions: uniqueIndex('playthrough_protocols_content_versions_idx').on(
      table.contentVersion,
      table.engineVersion,
      table.reportVersion,
    ),
  }),
);

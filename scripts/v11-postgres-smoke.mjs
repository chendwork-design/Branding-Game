import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const entrypoint = resolve(root, 'apps/api/dist/apps/api/src/v11-server.js');
const port = process.env.POSTGRES_SMOKE_PORT ?? '3398';
const baseUrl = `http://127.0.0.1:${port}`;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!process.env.SEED_ENCRYPTION_KEY) throw new Error('SEED_ENCRYPTION_KEY is required');

let child;
let output = '';

function startServer() {
  output = '';
  child = spawn(process.execPath, [entrypoint], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      V11_API_PORT: port,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  child.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolveTimeout) => setTimeout(() => resolveTimeout(false), 2_000)),
  ]);
  if (!stopped && child.exitCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep non-JSON error output available in the failure message.
  }
  return { response, body };
}

function jsonOptions(body, headers = {}) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

function cookieHeader(response) {
  const values =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function waitForReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`PostgreSQL API exited before ready (${child.exitCode}): ${output}`);
    try {
      const result = await request('/ready');
      if (result.response.ok) return result.body;
    } catch {
      // The process can need a short time to connect to PostgreSQL and bind its port.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`PostgreSQL API did not become ready: ${output}`);
}

function assertOk(result, label) {
  if (!result.response.ok)
    throw new Error(`${label} failed (${result.response.status}): ${JSON.stringify(result.body)}`);
}

try {
  startServer();
  const ready = await waitForReady();
  if (ready.status !== 'ready' || ready.contentVersion !== 'v1.4.0')
    throw new Error(`Unexpected ready response: ${JSON.stringify(ready)}`);

  const login = await request(
    '/api/v11/teacher/login',
    jsonOptions({ email: 'teacher@example.test', password: 'change-me-in-production' }),
  );
  assertOk(login, 'teacher login');
  const teacherCookie = cookieHeader(login.response);
  if (!teacherCookie) throw new Error('teacher login did not return a session cookie');

  const created = await request(
    '/api/v11/teacher/classes',
    jsonOptions({ name: 'PostgreSQL storage smoke' }, { cookie: teacherCookie }),
  );
  assertOk(created, 'class creation');
  if (created.body.contentVersion !== 'v1.4.0' || !created.body.code)
    throw new Error(`class was not bound to v1.4.0: ${JSON.stringify(created.body)}`);

  const joined = await request(
    '/api/v11/student/join',
    jsonOptions({
      classCode: created.body.code,
      studentNumber: `pg-smoke-${Date.now()}`,
      name: 'PostgreSQL smoke student',
    }),
  );
  assertOk(joined, 'student join');
  const studentHeaders = { 'x-student-token': joined.body.token };
  const playthroughId = joined.body.playthrough.id;

  const onboarding = {
    protocolVersion: '1.2',
    actionId: 'pg-smoke-onboarding',
    type: 'onboarding_completed',
    payload: {},
  };
  const firstAction = await request(
    '/api/v11/student/actions',
    jsonOptions(
      { playthroughId, action: onboarding, idempotencyKey: onboarding.actionId },
      studentHeaders,
    ),
  );
  assertOk(firstAction, 'onboarding action');

  const duplicateAction = await request(
    '/api/v11/student/actions',
    jsonOptions(
      { playthroughId, action: onboarding, idempotencyKey: onboarding.actionId },
      studentHeaders,
    ),
  );
  assertOk(duplicateAction, 'idempotent onboarding action');
  if (duplicateAction.body.log?.sequenceNo !== firstAction.body.log?.sequenceNo)
    throw new Error('idempotent action did not return the original log');

  const content = await request('/api/v11/content');
  assertOk(content, 'content request');
  const stageAction = content.body.rounds?.[0]?.stageActions?.[0];
  if (!stageAction) throw new Error('published content has no first-round stage action');
  const stage = {
    protocolVersion: '1.2',
    actionId: 'pg-smoke-stage-action',
    type: 'stage_action_selected',
    roundId: 'r01',
    payload: { actionId: stageAction.actionId },
  };
  const secondAction = await request(
    '/api/v11/student/actions',
    jsonOptions({ playthroughId, action: stage, idempotencyKey: stage.actionId }, studentHeaders),
  );
  assertOk(secondAction, 'stage action');

  await stopServer();
  startServer();
  const restartedReady = await waitForReady();
  if (restartedReady.status !== 'ready') throw new Error('restarted API is not ready');
  const restored = await request(`/api/v11/student/me?playthroughId=${playthroughId}`, {
    headers: studentHeaders,
  });
  assertOk(restored, 'student progress after API restart');
  if (restored.body.playthrough?.id !== playthroughId)
    throw new Error('student progress was not restored after API restart');

  console.log(
    JSON.stringify({
      status: 'passed',
      contentVersion: ready.contentVersion,
      classCode: created.body.code,
      playthroughId,
      restoredNextActionSequence: restored.body.playthrough.nextActionSequence,
    }),
  );
} finally {
  await stopServer();
}

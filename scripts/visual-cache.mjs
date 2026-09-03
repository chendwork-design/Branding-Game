import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const cacheRoot = join(root, '.cache', 'visual-production');
const directories = {
  root: cacheRoot,
  temporary: join(cacheRoot, 'tmp'),
  generatedImages: join(cacheRoot, 'generated-images'),
  qa: join(cacheRoot, 'qa'),
};
const codexGeneratedImages = join(homedir(), '.codex', 'generated_images');

function prepare() {
  Object.values(directories).forEach((directory) => mkdirSync(directory, { recursive: true }));
  return directories;
}

function isLinkedToProject() {
  if (!existsSync(codexGeneratedImages)) return false;

  try {
    return (
      realpathSync(codexGeneratedImages).toLowerCase() ===
      realpathSync(directories.generatedImages).toLowerCase()
    );
  } catch {
    return false;
  }
}

function linkCodexOutput() {
  prepare();

  if (existsSync(codexGeneratedImages)) {
    if (isLinkedToProject()) return 'already-linked';

    const stats = lstatSync(codexGeneratedImages);
    const kind = stats.isSymbolicLink() ? '链接' : '目录';
    throw new Error(
      `拒绝覆盖现有${kind}：${codexGeneratedImages}。请先人工确认其中的文件，再重新执行。`,
    );
  }

  mkdirSync(resolve(codexGeneratedImages, '..'), { recursive: true });
  symlinkSync(directories.generatedImages, codexGeneratedImages, 'junction');
  return 'linked';
}

function printStatus() {
  prepare();
  console.log(`视觉缓存：${directories.root}`);
  console.log(`临时目录：${directories.temporary}`);
  console.log(`图片落地：${directories.generatedImages}`);
  console.log(`Codex 图片目录：${isLinkedToProject() ? '已分流到本项目' : '尚未分流'}`);
}

function runWithVisualTemp(command) {
  if (command.length === 0)
    throw new Error('请在 -- 后提供要执行的命令，例如：pnpm visual:run -- pnpm test:e2e');

  prepare();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, TEMP: directories.temporary, TMP: directories.temporary },
  });
  process.exit(result.status ?? 1);
}

try {
  const [action = 'prepare', ...rest] = process.argv.slice(2);
  if (action === 'prepare') {
    prepare();
    printStatus();
  } else if (action === 'check') {
    printStatus();
    if (!isLinkedToProject()) process.exitCode = 1;
  } else if (action === 'link') {
    const result = linkCodexOutput();
    console.log(
      result === 'linked'
        ? '已将 Codex 生图落地目录分流到本项目。'
        : 'Codex 生图落地目录已指向本项目。',
    );
    printStatus();
  } else if (action === 'run') {
    runWithVisualTemp(rest[0] === '--' ? rest.slice(1) : rest);
  } else {
    throw new Error(`未知操作：${action}`);
  }
} catch (error) {
  console.error(`视觉缓存设置失败：${error.message}`);
  process.exitCode = 1;
}

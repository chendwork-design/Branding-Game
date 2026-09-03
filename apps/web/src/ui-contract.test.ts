import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const stylesPath = new URL('./styles.css', import.meta.url);
const appPath = new URL('./app.tsx', import.meta.url);
const teacherPath = new URL('./teacher.tsx', import.meta.url);
const playwrightConfigPath = new URL('../playwright.config.ts', import.meta.url);

describe('M3 mobile student shell contract', () => {
  it('reserves both safe-area edges for notched phones', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('env(safe-area-inset-top)');
    expect(styles).toContain('env(safe-area-inset-bottom)');
  });

  it('runs the planned Chromium and iPhone WebKit slices on configurable ports', async () => {
    const config = await readFile(playwrightConfigPath, 'utf8');
    expect(config).toContain("devices['iPhone 13']");
    expect(config).toContain('process.env.WEB_PORT');
    expect(config).toContain('process.env.API_PORT');
  });

  it('keeps chapter review and report teaching sections in the student surface', async () => {
    const app = await readFile(appPath, 'utf8');
    expect(app).toContain('chapter-review');
    expect(app).toContain('report.visualDiagnosis');
    expect(app).toContain('report.stakeholderNetwork');
    expect(app).toContain('report.assignmentTransfer');
  });

  it('keeps the teacher roster searchable and paged for a large class', async () => {
    const teacher = await readFile(teacherPath, 'utf8');
    expect(teacher).toContain('筛选学生');
    expect(teacher).toContain('上一页');
    expect(teacher).toContain('下一页');
  });
});

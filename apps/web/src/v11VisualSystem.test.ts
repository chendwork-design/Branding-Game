import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  V11_CORE_VISUAL_ROUTES,
  V11VisualMark,
  coreVisualRouteLabel,
  isCoreVisualRoute,
} from './v11VisualSystem.js';

describe('r08 visual system contract', () => {
  it('keeps exactly three comparable routes', () => {
    expect(V11_CORE_VISUAL_ROUTES).toEqual(['v-line', 'v-symbol', 'v-hand']);
    expect(new Set(V11_CORE_VISUAL_ROUTES).size).toBe(3);
  });

  it('does not revive retired reference-driven visual routes', () => {
    expect(isCoreVisualRoute('v-line')).toBe(true);
    expect(isCoreVisualRoute('v-symbol')).toBe(true);
    expect(isCoreVisualRoute('v-hand')).toBe(true);
    expect(isCoreVisualRoute('v-seal')).toBe(false);
    expect(coreVisualRouteLabel('v-symbol')).toBe('月门印记系统');
  });

  it('uses a symbol-only visual until the player establishes a brand name', () => {
    const markup = renderToStaticMarkup(
      createElement(V11VisualMark, { visualId: 'v-symbol', brandName: '' }),
    );
    expect(markup).toContain('月门印记系统');
    expect(markup).toContain('data-v11-mark="v-symbol"');
    expect(markup).not.toContain('你的品牌名');
    expect(markup).not.toContain('OLD STREET');
    expect(markup).not.toContain('CUP · LEAF');
    expect(markup).not.toContain('A WARM HELLO');
  });

  it('renders only the player-provided name once the brand is named', () => {
    const markup = renderToStaticMarkup(
      createElement(V11VisualMark, { visualId: 'v-line', brandName: '老街一盏茶' }),
    );
    expect(markup).toContain('老街一盏茶');
    expect(markup).not.toContain('你的品牌名');
  });

  it('gives every route a distinct original vector mark instead of reusing a cup illustration', () => {
    const marks = V11_CORE_VISUAL_ROUTES.map((visualId) =>
      renderToStaticMarkup(createElement(V11VisualMark, { visualId, brandName: '' })),
    );
    expect(marks[0]).toContain('data-v11-mark="v-line"');
    expect(marks[1]).toContain('data-v11-mark="v-symbol"');
    expect(marks[2]).toContain('data-v11-mark="v-hand"');
    expect(new Set(marks).size).toBe(3);
    expect(marks.every((mark) => !mark.includes('你的品牌名'))).toBe(true);
  });
});

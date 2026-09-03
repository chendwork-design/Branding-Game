import type { CSSProperties } from 'react';

export type V11CoreVisualRoute = 'v-line' | 'v-symbol' | 'v-hand';

export const V11_CORE_VISUAL_ROUTES: readonly V11CoreVisualRoute[] = [
  'v-line',
  'v-symbol',
  'v-hand',
];

const routeLabels: Record<V11CoreVisualRoute, string> = {
  'v-line': '线性字标系统',
  'v-symbol': '杯影符号系统',
  'v-hand': '服务型 IP 系统',
};

export function isCoreVisualRoute(value: string | undefined): value is V11CoreVisualRoute {
  return Boolean(value && V11_CORE_VISUAL_ROUTES.includes(value as V11CoreVisualRoute));
}

export function coreVisualRouteLabel(value: string | undefined): string {
  return isCoreVisualRoute(value) ? routeLabels[value] : '视觉系统';
}

function compactName(value: string): string {
  const normalized = value.trim();
  return normalized.length > 8 ? `${normalized.slice(0, 8)}…` : normalized || '你的品牌名';
}

export function V11VisualMark({
  visualId,
  brandName,
  className = '',
}: {
  visualId: string;
  brandName: string;
  className?: string;
}) {
  const route: V11CoreVisualRoute = isCoreVisualRoute(visualId) ? visualId : 'v-line';
  const label = compactName(brandName);
  const style = { '--v11-route': route } as CSSProperties;
  return (
    <svg
      className={`v11-brand-mark v11-brand-mark-${route} ${className}`}
      style={style}
      viewBox="0 0 300 150"
      role="img"
      aria-label={`${label}的${routeLabels[route]}`}
    >
      <rect className="v11-brand-mark-paper" x="1" y="1" width="298" height="148" rx="12" />
      {route === 'v-line' && <LineMark label={label} />}
      {route === 'v-symbol' && <SymbolMark label={label} />}
      {route === 'v-hand' && <CharacterMark label={label} />}
    </svg>
  );
}

function LineMark({ label }: { label: string }) {
  return (
    <>
      <path
        className="v11-brand-mark-line"
        d="M45 50 82 29 124 47 167 25 214 50"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      />
      <path
        className="v11-brand-mark-accent"
        d="M51 61h162"
        fill="none"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <text className="v11-brand-mark-name" x="150" y="107" textAnchor="middle">
        {label}
      </text>
      <text className="v11-brand-mark-subtitle" x="150" y="128" textAnchor="middle">
        OLD STREET TEA BAR
      </text>
    </>
  );
}

function SymbolMark({ label }: { label: string }) {
  return (
    <>
      <g className="v11-brand-mark-symbol" transform="translate(54 35)">
        <ellipse cx="38" cy="21" rx="33" ry="13" fill="none" strokeWidth="6" />
        <path
          d="M10 25v32c0 10 12 16 28 16s28-6 28-16V25"
          fill="none"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path d="M40 8c5-14 20-17 26-8-7 8-17 12-26 8Z" />
      </g>
      <path
        className="v11-brand-mark-accent"
        d="M129 43h122"
        fill="none"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <text className="v11-brand-mark-name v11-brand-mark-name-left" x="130" y="88">
        {label}
      </text>
      <text className="v11-brand-mark-subtitle v11-brand-mark-name-left" x="132" y="111">
        CUP · LEAF · STREET
      </text>
    </>
  );
}

function CharacterMark({ label }: { label: string }) {
  return (
    <>
      <g className="v11-brand-mark-character" transform="translate(48 26)">
        <path
          className="v11-brand-mark-character-body"
          d="M21 37h55l-6 56c-1 11-11 18-22 18H49c-11 0-21-7-22-18l-6-56Z"
        />
        <path
          className="v11-brand-mark-character-leaf"
          d="M71 26c4-18 22-26 34-17-7 16-21 23-34 17Z"
        />
        <path
          className="v11-brand-mark-character-steam"
          d="M35 17c-9-9 3-18 0-26M60 17c-9-9 3-18 0-26"
          fill="none"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          className="v11-brand-mark-character-gesture"
          d="M75 62c17-4 25-15 29-27"
          fill="none"
          strokeLinecap="round"
          strokeWidth="6"
        />
      </g>
      <text className="v11-brand-mark-name v11-brand-mark-name-left" x="156" y="76">
        {label}
      </text>
      <text className="v11-brand-mark-subtitle v11-brand-mark-name-left" x="158" y="100">
        A WARM HELLO, WELL MADE
      </text>
      <path
        className="v11-brand-mark-accent"
        d="M156 116h85"
        fill="none"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </>
  );
}

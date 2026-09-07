import type { CSSProperties } from 'react';

export type V11CoreVisualRoute = 'v-line' | 'v-symbol' | 'v-hand';

export const V11_CORE_VISUAL_ROUTES: readonly V11CoreVisualRoute[] = [
  'v-line',
  'v-symbol',
  'v-hand',
];

const routeLabels: Record<V11CoreVisualRoute, string> = {
  'v-line': '屋檐一笔系统',
  'v-symbol': '月门印记系统',
  'v-hand': '茶灯引路人系统',
};

export function isCoreVisualRoute(value: string | undefined): value is V11CoreVisualRoute {
  return Boolean(value && V11_CORE_VISUAL_ROUTES.includes(value as V11CoreVisualRoute));
}

export function coreVisualRouteLabel(value: string | undefined): string {
  return isCoreVisualRoute(value) ? routeLabels[value] : '视觉系统';
}

function compactName(value: string): string {
  const normalized = value.trim();
  return normalized.length > 8 ? `${normalized.slice(0, 8)}…` : normalized;
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
  const accessibleLabel = label ? `${label}的${routeLabels[route]}` : routeLabels[route];
  const style = { '--v11-route': route } as CSSProperties;
  return (
    <svg
      className={`v11-brand-mark v11-brand-mark-${route} ${className}`}
      style={style}
      viewBox="0 0 300 150"
      role="img"
      aria-label={accessibleLabel}
    >
      <rect className="v11-brand-mark-paper" x="1" y="1" width="298" height="148" rx="12" />
      <g data-v11-mark={route}>
        {route === 'v-line' && <LineMark label={label} />}
        {route === 'v-symbol' && <SymbolMark label={label} />}
        {route === 'v-hand' && <CharacterMark label={label} />}
      </g>
    </svg>
  );
}

function LineMark({ label }: { label: string }) {
  const position = label ? 'translate(34 28)' : 'translate(104 28)';
  return (
    <>
      <g transform={position}>
        <path
          className="v11-brand-mark-ink"
          d="M4 67C17 38 41 20 71 20c26 0 47 13 61 34"
          fill="none"
          strokeLinecap="round"
          strokeWidth="8"
        />
        <path
          className="v11-brand-mark-ink"
          d="M17 76 45 48l26 20 26-30 24 38"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <path
          className="v11-brand-mark-copper"
          d="M13 90h116"
          fill="none"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <circle className="v11-brand-mark-sage-fill" cx="71" cy="76" r="7" />
      </g>
      {label && (
        <text className="v11-brand-mark-name v11-brand-mark-name-left" x="178" y="81">
          {label}
        </text>
      )}
      {label && <path className="v11-brand-mark-accent" d="M178 95h78" fill="none" strokeWidth="4" />}
    </>
  );
}

function SymbolMark({ label }: { label: string }) {
  const position = label ? 'translate(38 24)' : 'translate(108 24)';
  return (
    <>
      <g transform={position}>
        <circle className="v11-brand-mark-sage-fill" cx="54" cy="51" r="46" />
        <path
          className="v11-brand-mark-paper-cut"
          d="M27 88V56c0-15 12-28 27-28s27 13 27 28v32H27Z"
        />
        <path
          className="v11-brand-mark-ink"
          d="M39 47c11-9 22-9 32 0M54 28v44"
          fill="none"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path className="v11-brand-mark-copper-fill" d="M72 18c7-17 25-20 32-7-7 14-20 19-32 7Z" />
      </g>
      {label && (
        <text className="v11-brand-mark-name v11-brand-mark-name-left" x="162" y="81">
          {label}
        </text>
      )}
      {label && <path className="v11-brand-mark-accent" d="M162 95h78" fill="none" strokeWidth="4" />}
    </>
  );
}

function CharacterMark({ label }: { label: string }) {
  const position = label ? 'translate(42 20)' : 'translate(112 20)';
  return (
    <>
      <g transform={position}>
        <path
          className="v11-brand-mark-ink"
          d="M54 8v16M29 31h50M35 31l6 65h26l6-65"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        <path
          className="v11-brand-mark-copper-fill"
          d="M39 40h30v36H39z"
        />
        <path
          className="v11-brand-mark-paper-cut"
          d="M54 48c8 0 13 5 13 11 0 9-8 14-13 19-5-5-13-10-13-19 0-6 5-11 13-11Z"
        />
        <path
          className="v11-brand-mark-sage"
          d="M78 45c16-11 27-7 31 1-13 12-25 11-31-1Z"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <path
          className="v11-brand-mark-sage"
          d="M26 107h56"
          fill="none"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </g>
      {label && (
        <text className="v11-brand-mark-name v11-brand-mark-name-left" x="166" y="81">
          {label}
        </text>
      )}
      {label && <path className="v11-brand-mark-accent" d="M166 95h78" fill="none" strokeWidth="4" />}
    </>
  );
}

"use client";

import { useId, useMemo, useState } from "react";

export interface AreaChartSeries {
  /** Libellé de la série, affiché dans la légende et l'infobulle. */
  name: string;
  /** Valeurs, alignées sur `labels`. */
  values: number[];
  /** Couleur du trait (variable CSS ou couleur). Par défaut : accent. */
  color?: string;
  /** Remplir l'aire sous la courbe (dégradé). Une seule série par graphe. */
  filled?: boolean;
}

interface AreaChartProps {
  /** Libellés d'axe x (dates ISO « 2026-08-16 »). */
  labels: string[];
  series: AreaChartSeries[];
  /** Hauteur de la zone de tracé, en pixels (sans la légende ni les axes). */
  height?: number;
  /** Formate un libellé d'axe x en texte court (« 16 août »). */
  formatX: (x: string) => string;
  /** Formate la valeur (par défaut : nombre brut). */
  valueFormatter?: (value: number) => string;
}

const round = (value: number): string => value.toFixed(2);

/** Indices des libellés d'axe x : au plus 6, régulièrement espacés. */
function tickIndices(length: number): number[] {
  if (length <= 1) return length === 1 ? [0] : [];
  const count = Math.min(length, 6);
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i / (count - 1)) * (length - 1)));
  }
  return [...indices];
}

/**
 * Graphe en aires multi-séries, sans dépendance.
 *
 * Le tracé vit dans un `viewBox` 0→100 étiré sur toute la largeur ; légende,
 * libellés et infobulle restent en HTML pour ne jamais être déformés. Courbe
 * lissée (Catmull-Rom → Bézier), dégradé d'accent, guide et infobulle au
 * survol.
 */
export function AreaChart({
  labels,
  series,
  height = 160,
  formatX,
  valueFormatter,
}: AreaChartProps) {
  const gradientBaseId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(
    () => Math.max(1, ...series.flatMap((entry) => entry.values)),
    [series]
  );
  const formatValue = valueFormatter ?? ((value: number) => String(value));

  if (labels.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-content-muted"
      >
        Aucune donnée sur cette période.
      </div>
    );
  }

  const n = labels.length;
  const xFor = (index: number): number => (n <= 1 ? 50 : (index / (n - 1)) * 100);
  const yFor = (value: number): number => Math.min(96, Math.max(4, 100 - (value / max) * 100));

  const coordsPerSeries = series.map((entry) =>
    entry.values.map((value, index) => ({ x: xFor(index), y: yFor(value) }))
  );

  // Courbe lissée : chaque segment p1→p2 devient une cubique dont les points
  // de contrôle s'appuient sur les voisins p0 et p3.
  const pathFor = (coords: { x: number; y: number }[]): { line: string; area: string } => {
    const m = coords.length;
    let line = `M ${round(coords[0].x)} ${round(coords[0].y)}`;
    for (let i = 0; i < m - 1; i++) {
      const p0 = coords[i - 1] ?? coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      line += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
    }
    const area =
      m === 1
        ? `${line} L ${round(coords[0].x)} 100 L ${round(coords[0].x)} 100 Z`
        : `${line} L ${round(coords[m - 1].x)} 100 L ${round(coords[0].x)} 100 Z`;
    return { line, area };
  };

  const hovered = hover !== null ? labels[hover] : null;
  const hoverX = hover !== null ? xFor(hover) : 0;

  // L'infobulle se centre sous le curseur, sauf aux bords où elle bascule
  // pour ne pas sortir du cadre.
  const tooltipAlign = hoverX < 25 ? "0%" : hoverX > 75 ? "-100%" : "-50%";

  return (
    <div className="w-full">
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((entry) => (
            <span key={entry.name} className="flex items-center gap-1.5 text-xs text-content-muted">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color ?? "var(--color-accent)" }}
              />
              {entry.name}
            </span>
          ))}
        </div>
      )}

      <div className="relative" style={{ height }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            {series.map(
              (entry, seriesIndex) =>
                entry.filled && (
                  <linearGradient
                    key={seriesIndex}
                    id={`${gradientBaseId}-${seriesIndex}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      style={{ stopColor: entry.color ?? "var(--color-accent)", stopOpacity: 0.28 }}
                    />
                    <stop
                      offset="100%"
                      style={{ stopColor: entry.color ?? "var(--color-accent)", stopOpacity: 0 }}
                    />
                  </linearGradient>
                )
            )}
          </defs>

          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {coordsPerSeries.map((coords, seriesIndex) => {
            const entry = series[seriesIndex];
            const { line, area } = pathFor(coords);
            return (
              <g key={entry.name}>
                {entry.filled && (
                  <path d={area} fill={`url(#${gradientBaseId}-${seriesIndex})`} />
                )}
                <path
                  d={line}
                  fill="none"
                  stroke={entry.color ?? "var(--color-accent)"}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* Un point unique n'a pas de courbe : on dessine un simple point. */}
        {n === 1 &&
          coordsPerSeries.map((coords, seriesIndex) => (
            <div
              key={series[seriesIndex].name}
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${coords[0].x}%`,
                top: `${coords[0].y}%`,
                backgroundColor: series[seriesIndex].color ?? "var(--color-accent)",
              }}
            />
          ))}

        {/* Colonnes invisibles pour le survol : une par point. */}
        <div className="absolute inset-0 flex">
          {labels.map((label, index) => (
            <div
              key={label}
              className="h-full flex-1"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>

        {hover !== null && hovered !== null && (
          <>
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-content-muted/40"
              style={{ left: `${hoverX}%` }}
            />
            {coordsPerSeries.map((coords, seriesIndex) => (
              <div
                key={series[seriesIndex].name}
                className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-1"
                style={{
                  left: `${coords[hover].x}%`,
                  top: `${coords[hover].y}%`,
                  backgroundColor: series[seriesIndex].color ?? "var(--color-accent)",
                }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1.5 text-[11px] shadow-sm"
              style={{ left: `${hoverX}%`, transform: `translateX(${tooltipAlign})` }}
            >
              <p className="font-medium text-content-primary">{formatX(hovered)}</p>
              {series.map((entry) => (
                <p key={entry.name} className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color ?? "var(--color-accent)" }}
                  />
                  <span className="text-content-muted">{entry.name} :</span>
                  <span className="font-medium tabular-nums text-content-primary">
                    {formatValue(entry.values[hover])}
                  </span>
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative mt-1.5 h-4">
        {tickIndices(n).map((index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] leading-4 text-content-muted"
            style={{ left: `${xFor(index)}%` }}
          >
            {formatX(labels[index])}
          </span>
        ))}
      </div>
    </div>
  );
}

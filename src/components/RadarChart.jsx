import React, { useMemo, useState } from 'react';

const METRIC_KEYS = ['NLOC', 'CCN', 'in_degree', 'out_degree', 'warningScore'];
const METRIC_LABELS = {
  NLOC: 'NLOC',
  CCN: 'CCN',
  in_degree: 'In degree',
  out_degree: 'Out degree',
  warningScore: 'Warning score',
};

const COLORS = ['#1d4ed8', '#16a34a', '#ea580c', '#9333ea'];

const RadarChart = ({ functions }) => {
  const [tooltip, setTooltip] = useState(null); // { x, y, funcName, metricKey, value }

  const processed = useMemo(() => {
    if (!functions || functions.length === 0) return [];
    return functions.map((func, idx) => {
      const severityCounts = func.severityCounts || {
        High: func.warning?.HIGH || 0,
        Medium: func.warning?.MID || 0,
        Low: func.warning?.LOW || 0,
      };
      const warningScore =
        (severityCounts.High || 0) * 3 +
        (severityCounts.Medium || 0) * 2 +
        (severityCounts.Low || 0);

      return {
        index: idx,
        name: func.name,
        NLOC: func.NLOC || 0,
        CCN: func.complexity || func.CCN || 0,
        in_degree: func.in_degree || 0,
        out_degree: func.out_degree ?? func.callCount ?? 0,
        warningScore,
      };
    });
  }, [functions]);

  const maxValues = useMemo(() => {
    const result = {};
    METRIC_KEYS.forEach((key) => {
      result[key] = processed.reduce(
        (max, f) => (f[key] > max ? f[key] : max),
        0,
      );
    });
    return result;
  }, [processed]);

  if (!functions || functions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
        함수를 선택하면 Radar 차트가 표시됩니다.
      </div>
    );
  }

  const size = 320;
  const center = size / 2;
  const radius = size / 2 - 40;
  const angleStep = (Math.PI * 2) / METRIC_KEYS.length;

  const getPoint = (angleIndex, value, metricKey) => {
    const max = maxValues[metricKey] || 1;
    const ratio = max === 0 ? 0 : value / max;
    const r = radius * ratio;
    const angle = angleStep * angleIndex - Math.PI / 2;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Radar Chart</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {processed.map((f, idx) => (
            <div key={f.name} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-gray-700">{f.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="max-w-full max-h-full"
          onMouseLeave={() => setTooltip(null)}
        >
          {rings.map((ratio, idx) => {
            const points = METRIC_KEYS.map((metricKey, i) => {
              const angle = angleStep * i - Math.PI / 2;
              const r = radius * ratio;
              return {
                x: center + r * Math.cos(angle),
                y: center + r * Math.sin(angle),
              };
            });
            const d = points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
              .join(' ') + ' Z';
            return (
              <path
                key={ratio}
                d={d}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            );
          })}

          {METRIC_KEYS.map((metricKey, i) => {
            const angle = angleStep * i - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            const labelOffset = 16;
            const lx = center + (radius + labelOffset) * Math.cos(angle);
            const ly = center + (radius + labelOffset) * Math.sin(angle);

            return (
              <g key={metricKey}>
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px]"
                  fill="#4b5563"
                >
                  {METRIC_LABELS[metricKey]}
                </text>
              </g>
            );
          })}

          {processed.map((func, idx) => {
            const points = METRIC_KEYS.map((metricKey, i) =>
              getPoint(i, func[metricKey], metricKey),
            );
            const d = points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
              .join(' ') + ' Z';
            const color = COLORS[idx % COLORS.length];

            return (
              <g key={func.name}>
                <path
                  d={d}
                  fill={color + '33'}
                  stroke={color}
                  strokeWidth={2}
                />
                {points.map((p, pi) => {
                  const metricKey = METRIC_KEYS[pi];
                  return (
                    <circle
                      key={`${func.name}-${metricKey}`}
                      cx={p.x}
                      cy={p.y}
                      r={3}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={1}
                      onMouseEnter={(e) => {
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          funcName: func.name,
                          metricKey,
                          value: func[metricKey],
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            );
          })}

          <circle cx={center} cy={center} r={2} fill="#6b7280" />
        </svg>
      </div>
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg"
          style={{
            top: tooltip.y + 8,
            left: tooltip.x + 8,
          }}
        >
          <div className="font-semibold mb-0.5">{tooltip.funcName}</div>
          <div className="text-[10px] text-gray-200">
            {METRIC_LABELS[tooltip.metricKey]}: {tooltip.value}
          </div>
        </div>
      )}
    </div>
  );
};

export default RadarChart;

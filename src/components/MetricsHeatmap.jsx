import React, { useMemo } from 'react';

const METRIC_KEYS = ['NLOC', 'CCN', 'in_degree', 'out_degree', 'warningScore'];
const METRIC_LABELS = {
  NLOC: 'NLOC',
  CCN: 'CCN',
  in_degree: 'In degree',
  out_degree: 'Out degree',
  warningScore: 'Warning score',
};

const getRankColors = (values) => {
  if (!values.length) return [];

  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => b - a);

  const palette = ['#7f1d1d', '#b91c1c', '#ef4444', '#f97373', '#fee2e2'];

  return values.map((v) => {
    if (uniqueSorted.length === 1) {
      return palette[2];
    }
    const rank = uniqueSorted.indexOf(v);
    const ratio = uniqueSorted.length === 1 ? 0 : rank / (uniqueSorted.length - 1);
    const level = Math.min(
      palette.length - 1,
      Math.max(0, Math.round(ratio * (palette.length - 1))),
    );
    return palette[level];
  });
};

const MetricsHeatmap = ({ functions }) => {
  const processed = useMemo(() => {
    if (!functions || functions.length === 0) return [];
    return functions.map((func) => {
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
        name: func.name,
        NLOC: func.NLOC || 0,
        CCN: func.complexity || func.CCN || 0,
        in_degree: func.in_degree || 0,
        out_degree: func.out_degree ?? func.callCount ?? 0,
        warningScore,
      };
    });
  }, [functions]);

  if (!functions || functions.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
        함수를 선택하면 Heatmap이 표시됩니다.
      </div>
    );
  }

  if (functions.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center text-center text-sm text-gray-500 px-4">
        Heatmap은 2개 이상, 최대 5개의 함수를 선택했을 때 표시됩니다.
      </div>
    );
  }

  const colorsByMetric = {};
  METRIC_KEYS.forEach((metricKey) => {
    const values = processed.map((f) => f[metricKey]);
    colorsByMetric[metricKey] = getRankColors(values);
  });

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Metrics Heatmap</h3>
          <div className="relative group">
            <button
              type="button"
              className="w-4 h-4 flex items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-600 bg-white hover:bg-gray-50"
              aria-label="Metrics 설명"
            >
              i
            </button>
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block w-72 rounded-md border border-gray-200 bg-white p-3 text-[11px] text-gray-700 shadow-lg z-10">
              <div className="font-semibold mb-1 text-gray-900">Metric 정의</div>
              <ul className="space-y-1">
                <li><span className="font-semibold">NLOC</span>: 함수의 유효 코드 라인 수 (Number of Lines of Code)</li>
                <li><span className="font-semibold">CCN</span>: 순환 복잡도 (Cyclomatic Complexity)</li>
                <li><span className="font-semibold">In degree</span>: 해당 함수를 호출하는 다른 함수 수</li>
                <li><span className="font-semibold">Out degree</span>: 해당 함수가 호출하는 다른 함수 수</li>
                <li>
                  <span className="font-semibold">Warning score</span>: 심각도 가중치를 적용한 경고 점수<br />
                  <span className="font-mono">
                    Warning score = High × 3 + Medium × 2 + Low × 1
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="text-[11px] text-gray-500">
          컬럼별로 상대적인 크기를 색으로 비교합니다.
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border border-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="border-b border-gray-200 px-2 py-2 text-left text-gray-700">
                Function
              </th>
              {METRIC_KEYS.map((metricKey) => (
                <th
                  key={metricKey}
                  className="border-b border-l border-gray-200 px-2 py-2 text-center text-gray-700"
                >
                  {METRIC_LABELS[metricKey]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.map((func, rowIdx) => (
              <tr key={func.name} className="bg-white">
                <td className="border-t border-gray-200 px-2 py-1.5 text-gray-800 whitespace-nowrap">
                  {func.name}
                </td>
                {METRIC_KEYS.map((metricKey) => {
                  const value = func[metricKey];
                  const color = colorsByMetric[metricKey][rowIdx];
                  return (
                    <td
                      key={metricKey}
                      className="border-t border-l border-gray-200 px-2 py-1.5 text-center"
                      style={{ backgroundColor: color }}
                    >
                      <span className="inline-block px-1 rounded bg-white/40 text-[11px] text-gray-900">
                        {value}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MetricsHeatmap;

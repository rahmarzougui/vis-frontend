import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockFunctions, mockNodes } from '../mockData';
import CallGraph from '../components/CallGraph';

const PRESETS = [
  { id: 'complexity', label: 'High Complexity' },
  { id: 'severity', label: 'Risky Warnings' },
  { id: 'easy', label: 'Easy Fixes' }
];

const getDefaultFilters = (preset) => {
  switch (preset) {
    case 'complexity':
      return { minWarnings: '1', severity: 'High', minDegree: '3' };
    case 'severity':
      return { minComplexity: '5', minWarnings: '1' };
    case 'easy':
      return { minEasyFix: '1', maxComplexity: '12' };
    default:
      return {};
  }
};

const FILTER_CONFIG = {
  complexity: [
    {
      key: 'minWarnings',
      label: '최소 경고 수',
      options: [
        { value: '0', label: '전체' },
        { value: '1', label: '1개 이상' },
        { value: '2', label: '2개 이상' },
        { value: '3', label: '3개 이상' }
      ]
    },
    {
      key: 'severity',
      label: '집중할 심각도',
      options: [
        { value: 'any', label: '전체' },
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' }
      ]
    },
    {
      key: 'minDegree',
      label: '최소 연결도 (degree)',
      options: [
        { value: '0', label: '전체' },
        { value: '2', label: '2+' },
        { value: '3', label: '3+' },
        { value: '4', label: '4+' },
        { value: '6', label: '6+' }
      ]
    }
  ],
  severity: [
    {
      key: 'minComplexity',
      label: '최소 복잡도',
      options: [
        { value: '0', label: '전체' },
        { value: '5', label: '5+' },
        { value: '8', label: '8+' },
        { value: '12', label: '12+' }
      ]
    },
    {
      key: 'minWarnings',
      label: '최소 경고 수',
      options: [
        { value: '1', label: '1+' },
        { value: '2', label: '2+' },
        { value: '3', label: '3+' }
      ]
    }
  ],
  easy: [
    {
      key: 'minEasyFix',
      label: 'Easy-to-fix 경고 수',
      options: [
        { value: '0', label: '전체' },
        { value: '1', label: '1+' },
        { value: '2', label: '2+' }
      ]
    },
    {
      key: 'maxComplexity',
      label: '최대 복잡도',
      options: [
        { value: '0', label: '제한 없음' },
        { value: '6', label: '6 이하' },
        { value: '10', label: '10 이하' },
        { value: '12', label: '12 이하' },
        { value: '14', label: '14 이하' }
      ]
    }
  ]
};

const WarningsPage = () => {
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState('complexity');
  const [filters, setFilters] = useState(getDefaultFilters('complexity'));
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(true);

  const functionsWithMetrics = useMemo(() => {
    const degreeMap = mockNodes.reduce((acc, node) => {
      acc[node.id] = node.degree || 0;
      return acc;
    }, {});

    return mockFunctions.map(func => {
      const warnings = func.warnings || [];
      const severityCounts = warnings.reduce((acc, warning) => {
        const severity = warning?.severity || 'Unknown';
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, { High: 0, Medium: 0, Low: 0 });

      const dominantSeverity = severityCounts.High
        ? 'High'
        : severityCounts.Medium
          ? 'Medium'
          : severityCounts.Low
            ? 'Low'
            : 'None';

      return {
        ...func,
        warningCount: warnings.length,
        severityCounts,
        dominantSeverity,
        easyFixCount: warnings.filter(warning => warning?.severity === 'Low').length,
        degree: degreeMap[func.name] || 0
      };
    });
  }, []);

  const filteredFunctions = useMemo(() => {
    let data = [...functionsWithMetrics];

    if (selectedPreset === 'complexity') {
      const minWarnings = Number(filters.minWarnings || 0);
      const minDegree = Number(filters.minDegree || 0);
      data = data.filter(func => func.warningCount >= minWarnings && func.degree >= minDegree);
      if (filters.severity && filters.severity !== 'any') {
        data = data.filter(func => func.severityCounts[filters.severity] > 0);
      }
      data.sort((a, b) => b.complexity - a.complexity);
    } else if (selectedPreset === 'severity') {
      const minComplexity = Number(filters.minComplexity || 0);
      const minWarnings = Number(filters.minWarnings || 0);
      data = data.filter(func => func.complexity >= minComplexity && func.warningCount >= minWarnings);
      data.sort((a, b) => (b.severityCounts.High || 0) - (a.severityCounts.High || 0));
    } else if (selectedPreset === 'easy') {
      const minEasyFix = Number(filters.minEasyFix || 0);
      const maxComplexity = Number(filters.maxComplexity || 0);
      data = data.filter(func => func.easyFixCount >= minEasyFix);
      if (maxComplexity) {
        data = data.filter(func => func.complexity <= maxComplexity);
      }
      data.sort((a, b) => b.easyFixCount - a.easyFixCount);
    }

    return data;
  }, [functionsWithMetrics, selectedPreset, filters]);

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setFilters(getDefaultFilters(preset));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleFunctionSelect = (funcName) => {
    setSelectedFunction(prev => (prev === funcName ? null : funcName));
  };

  const handleNodeClick = (node) => {
    if (!node) return;
    const targetFunction = functionsWithMetrics.find(func => func.name === node.id);
    if (targetFunction) {
      setSelectedFunction(targetFunction.name);
      navigate(`/function/${targetFunction.id}`);
    } else {
      setSelectedFunction(node.id);
    }
  };

  const selectedFunctionMeta = functionsWithMetrics.find(func => func.name === selectedFunction);
  const selectedPresetMeta = PRESETS.find(preset => preset.id === selectedPreset) || {};

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] bg-gray-50">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel */}
        <div
          className={`relative bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
            isPresetPanelOpen ? 'w-full lg:w-1/4' : 'w-0 lg:w-[1.75rem] border-r-0'
          }`}
        >
          <button
            onClick={() => setIsPresetPanelOpen(prev => !prev)}
            className="absolute top-4 -right-3 z-10 bg-primary text-white rounded-full shadow-lg w-9 h-9 flex items-center justify-center text-base transition-transform hover:scale-105"
            aria-label="탐색 기준 패널 토글"
          >
            {isPresetPanelOpen ? '◀' : '▶'}
          </button>
          <div
            className={`h-full p-6 overflow-y-auto transition-opacity duration-200 ${
              isPresetPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {isPresetPanelOpen && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">탐색 기준 Preset</h2>
                      <p className="text-sm text-gray-500">상황에 맞게 탐색 전략을 선택하세요</p>
                    </div>
                    <button
                      onClick={() => setFilters(getDefaultFilters(selectedPreset))}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      필터 초기화
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetChange(preset.id)}
                        className={`text-center rounded-xl border px-3 py-2 transition-all flex-1 ${
                          selectedPreset === preset.id
                            ? 'border-primary shadow-sm bg-blue-50/80'
                            : 'border-gray-200 hover:border-primary hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xs font-semibold text-gray-900">{preset.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">함수 목록</h3>
                      <span className="text-xs text-gray-500">{filteredFunctions.length}개 함수</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mb-2">
                      카드 선택 시 그래프에서 함수와 연결 관계가 하이라이트 됩니다.
                    </div>
                    <div className="space-y-1.5">
                      {filteredFunctions.slice(0, 15).map(func => {
                        const isSelected = selectedFunction === func.name;
                        return (
                          <div
                            key={func.id}
                            className={`rounded-lg border p-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-primary text-white border-transparent shadow-md'
                                : 'bg-white border-gray-200 hover:border-primary hover:shadow-sm'
                            }`}
                            onClick={() => handleFunctionSelect(func.name)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                  {func.name}
                                </h4>
                                <p className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                                  {func.file}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                  <div className={`text-[9px] font-medium ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                    CC
                                  </div>
                                  <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                    {func.complexity}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <div className={`rounded px-1.5 py-0.5 text-[9px] ${isSelected ? 'bg-white/15 text-white' : 'bg-gray-50 text-gray-600'}`}>
                                경고 {func.warningCount}
                              </div>
                              <div className={`rounded px-1.5 py-0.5 text-[9px] ${isSelected ? 'bg-white/15 text-white' : 'bg-gray-50 text-gray-600'}`}>
                                D {func.degree}
                              </div>
                              <div className={`rounded px-1.5 py-0.5 text-[9px] ${isSelected ? 'bg-white/15 text-white' : 'bg-gray-50 text-gray-600'}`}>
                                E {func.easyFixCount}
                              </div>
                              {['High', 'Medium', 'Low'].map(level =>
                                func.severityCounts[level] ? (
                                  <span
                                    key={level}
                                    className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] border ${
                                      isSelected
                                        ? 'border-white/30 text-white'
                                        : 'border-gray-200 text-gray-600'
                                    }`}
                                  >
                                    {level[0]}{func.severityCounts[level]}
                                  </span>
                                ) : null
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredFunctions.length === 0 && (
                        <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center">
                          선택된 조건을 만족하는 함수가 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className={`w-full ${isPresetPanelOpen ? 'lg:w-3/4' : 'lg:w-full'} bg-white px-5 py-1 overflow-hidden transition-all duration-300`}>
          <div className="h-full flex flex-col">
            <div className="mb-1 flex flex-col gap-1 md:flex-row md:items-center md:space-x-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">Call Graph Visualization</h2>
                <div className="relative group">
                  <button
                    type="button"
                    aria-label="Call Graph 안내"
                    className="w-6 h-6 rounded-full border border-gray-300 text-xs font-semibold text-gray-600 bg-white hover:bg-gray-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    i
                  </button>
                  <div className="absolute left-0 md:left-auto md:right-0 mt-2 hidden w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg group-hover:flex group-focus-within:flex">
                    좌측 리스트에서 함수를 선택하거나 그래프 노드를 클릭하면 해당 함수와 1-hop 연결이 하이라이트 됩니다.
                  </div>
                </div>
                {selectedFunctionMeta && (
                  <div className="ml-1 text-xs text-gray-500">
                    선택된 함수:{' '}
                    <span className="font-semibold text-gray-900">
                      {selectedFunctionMeta.name}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 md:flex-1 md:justify-center">
                {FILTER_CONFIG[selectedPreset]?.map(filter => (
                  <div key={filter.key} className="flex flex-col text-xs gap-0.5 min-w-[135px]">
                    <label className="font-medium text-gray-500 leading-tight text-[12px]">{filter.label}</label>
                    <select
                      value={filters[filter.key] || filter.options[0].value}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                    >
                      {filter.options.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => setSelectedFunction(null)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  그래프 초기화
                </button>
              </div>
            </div>
            <div className="flex-1">
              <CallGraph 
                selectedFunction={selectedFunction}
                onNodeClick={handleNodeClick}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarningsPage;

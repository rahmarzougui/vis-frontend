import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import sqliteFunctions from '../../sqlite_function.json';
import sqliteWarnings from '../../sqlite_warning.json';
import CallGraphWebGL from '../components/CallGraphWebGL';
import RadarChart from '../components/RadarChart';
import MetricsHeatmap from '../components/MetricsHeatmap';

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

const WarningsPage = ({
  mode = 'local',
  githubUrl = '',
  backendGraphLoaded = false,
  backendFunctions = null,
  backendWarnings = null,
  backendCg = null,
}) => {
  const navigate = useNavigate();
  const [selectedPreset, setSelectedPreset] = useState('complexity');
  const [filters, setFilters] = useState(getDefaultFilters('complexity'));
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(true);
  const [overviewWindowStates, setOverviewWindowStates] = useState(new Map()); // Map<functionName, 'closed' | 'minimized' | 'maximized'>
  const [windowPositions, setWindowPositions] = useState(new Map()); // Map<functionName, { x: number, y: number }>
  const [draggedWindow, setDraggedWindow] = useState(null); // { funcName: string, startX: number, startY: number, offsetX: number, offsetY: number, hasDragged: boolean }
  const [wasDragged, setWasDragged] = useState(new Map()); // Map<funcName, boolean> - track if window was dragged
  const [manualSelection, setManualSelection] = useState([]); // Array of function names for subgraph display
  const [functionSearchQuery, setFunctionSearchQuery] = useState(''); // Search query for function list
  const [callGraphSearchName, setCallGraphSearchName] = useState(''); // Selected function name for call graph search
  const [isDataViewerOpen, setIsDataViewerOpen] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState('cg'); // 'cg' | 'functions' | 'warnings'
  const [notification, setNotification] = useState(null); // { message: string, type: 'info' | 'error' }
  const [graphViewMode, setGraphViewMode] = useState('graph'); // 'graph' | 'radar_heatmap'
  const [selectionHistory, setSelectionHistory] = useState([]); // Array of function names (recent selections)
  const [isHistoryMode, setIsHistoryMode] = useState(false); // true = show selection history instead of filtered list
  const [graphResetCounter, setGraphResetCounter] = useState(0); // Force CallGraphWebGL remount on reset

  const usingBackend = mode === 'backend';

  // 모드 전환 감지 (렌더 시점에 직전 모드와 비교)
  const prevModeRef = useRef(mode);
  const modeJustChanged = prevModeRef.current !== mode;
  if (modeJustChanged) {
    prevModeRef.current = mode;
  }

  // 모드 전환 시 선택 상태 및 오버뷰 창 초기화
  useEffect(() => {
    setManualSelection([]);
    setSelectedFunction(null);
    setOverviewWindowStates(new Map());
    setWindowPositions(new Map());
  }, [mode]);

  const functionsSource = usingBackend
    ? (backendFunctions || [])
    : sqliteFunctions;

  const warningsSource = usingBackend
    ? (backendWarnings || [])
    : sqliteWarnings;

  // Create a map of function name -> function data
  const functionDataMap = useMemo(() => {
    const map = new Map();
    functionsSource.forEach((func, index) => {
      map.set(func.function, {
        ...func,
        id: index + 1
      });
    });
    return map;
  }, [functionsSource]);

  // Create a map of function name -> warnings
  const warningsByFunction = useMemo(() => {
    const map = new Map();
    warningsSource.forEach(warning => {
      const funcName = warning.function;
      if (!map.has(funcName)) {
        map.set(funcName, []);
      }
      // Format warning to match expected structure
      map.get(funcName).push({
        id: warning.id,
        type: warning.warning,
        severity: warning.severity_level === 'HIGH' ? 'High' : warning.severity_level === 'MID' ? 'Medium' : 'Low',
        description: warning.detail,
        file: warning.file,
        line: warning.line,
        tool: warning.tool,
        category: warning.category
      });
    });
    return map;
  }, [warningsSource]);

  const functionsWithMetrics = useMemo(() => {
    // Use ALL functions from selected source
    return functionsSource.map((funcData, index) => {
      const functionName = funcData.function;
      const functionWarnings = warningsByFunction.get(functionName) || [];

      const warning = funcData.warning || { HIGH: 0, MID: 0, LOW: 0 };
      const severityCounts = {
        High: warning.HIGH || 0,
        Medium: warning.MID || 0,
        Low: warning.LOW || 0
      };
      const warningCount = warning.HIGH + warning.MID + warning.LOW;

      return {
        id: index + 1,
        name: functionName,
        complexity: funcData.CCN || 0,
        file: funcData.file || `src/${functionName}.c`,
        callCount: funcData.out_degree || 0,
        description: `Function ${functionName}`,
        warnings: functionWarnings,
        warningCount,
        severityCounts,
        dominantSeverity: severityCounts.High > 0 ? 'High' : severityCounts.Medium > 0 ? 'Medium' : severityCounts.Low > 0 ? 'Low' : 'None',
        easyFixCount: severityCounts.Low,
        degree: funcData.degree || 0,
        NLOC: funcData.NLOC,
        length: funcData.length,
        param: funcData.param,
        in_degree: funcData.in_degree || 0,
        out_degree: funcData.out_degree || 0
      };
    });
  }, [functionsSource, warningsByFunction]);

  const filteredFunctions = useMemo(() => {
    let data = [...functionsWithMetrics];

    // Apply preset filters
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

    // Apply search filter
    if (functionSearchQuery.trim()) {
      const query = functionSearchQuery.toLowerCase();
      data = data.filter(func => 
        func.name.toLowerCase().includes(query) || 
        func.file.toLowerCase().includes(query)
      );
    }

    return data;
  }, [functionsWithMetrics, selectedPreset, filters, functionSearchQuery]);

  const isEasyPreset = selectedPreset === 'easy';

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    setFilters(getDefaultFilters(preset));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };


  const handleNodeClick = (node) => {
    if (!node) return;
    const nodeId = node.id || node.name;
    const targetFunction = functionsWithMetrics.find(func => func.name === nodeId);
    
    if (targetFunction) {
      const funcName = targetFunction.name;
      
      // Handle subgraph selection (same as handleFunctionSelect)
      if (manualSelection.includes(funcName)) {
        // Remove from selection if already selected
        setManualSelection(prev => prev.filter(name => name !== funcName));
        // Remove window state for this function
        setOverviewWindowStates(prev => {
          const newMap = new Map(prev);
          newMap.delete(funcName);
          return newMap;
        });
        setWindowPositions(prev => {
          const newMap = new Map(prev);
          newMap.delete(funcName);
          return newMap;
        });
      } else {
        const maxSelectable =
          graphViewMode === 'radar_heatmap' ? 5 : 2;
        if (manualSelection.length >= maxSelectable) {
          setNotification({
            message:
              graphViewMode === 'radar_heatmap'
                ? 'Radar/Heatmap 모드에서는 최대 5개의 함수까지 선택할 수 있습니다. 다른 함수를 선택하려면 먼저 일부를 해제하세요.'
                : 'Call graph 모드에서는 한 번에 최대 2개의 함수만 비교할 수 있습니다. 다른 함수를 선택하려면 먼저 일부를 해제하세요.',
            type: 'error'
          });
          // Auto-dismiss after 4 seconds
          setTimeout(() => setNotification(null), 4000);
          return;
        }
        
        // Add to selection (limit of 2)
        setManualSelection(prev => [...prev, funcName]);
        // Update selection history (most recent first, max 20, no duplicates)
        setSelectionHistory(prev => {
          const next = [funcName, ...prev.filter(name => name !== funcName)];
          return next.slice(0, 20);
        });
        setSelectedFunction(funcName);
        // Set window state to minimized for this function (start collapsed)
        setOverviewWindowStates(prev => {
          const newMap = new Map(prev);
          newMap.set(funcName, 'minimized');
          return newMap;
        });
        // Set initial position on the right side
        setWindowPositions(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(funcName)) {
            const existingWindows = Array.from(newMap.keys()).length;
            // Y offset: edge filter button group (top:10 + height:~41) + gap(10) = 61, rounded to 60
            newMap.set(funcName, { x: 0, y: 60 + existingWindows * 420 });
          }
          return newMap;
        });
      }
    } else {
      // Fallback for functions not in our list
      setSelectedFunction(nodeId);
      setOverviewWindowStates(prev => {
        const newMap = new Map(prev);
        newMap.set(nodeId, 'minimized');
        return newMap;
      });
    }
  };

  const handleFunctionSelect = (funcName) => {
    // Handle subgraph selection
    if (manualSelection.includes(funcName)) {
      // Remove from selection
      setManualSelection(prev => prev.filter(name => name !== funcName));
      // Remove window state and position for this function
      setOverviewWindowStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(funcName);
        return newMap;
      });
      setWindowPositions(prev => {
        const newMap = new Map(prev);
        newMap.delete(funcName);
        return newMap;
      });
    } else {
      const maxSelectable =
        graphViewMode === 'radar_heatmap' ? 5 : 2;
      if (manualSelection.length >= maxSelectable) {
        setNotification({
          message:
            graphViewMode === 'radar_heatmap'
              ? 'Radar/Heatmap 모드에서는 최대 5개의 함수까지 선택할 수 있습니다. 다른 함수를 선택하려면 먼저 일부를 해제하세요.'
              : 'Call graph 모드에서는 한 번에 최대 2개의 함수만 비교할 수 있습니다. 다른 함수를 선택하려면 먼저 일부를 해제하세요.',
          type: 'error'
        });
        // Auto-dismiss after 4 seconds
        setTimeout(() => setNotification(null), 4000);
        return;
      }
      
        // Add to selection (limit of 2)
        setManualSelection(prev => [...prev, funcName]);
        // Update selection history
        setSelectionHistory(prev => {
          const next = [funcName, ...prev.filter(name => name !== funcName)];
          return next.slice(0, 20);
        });
      // Set window state to minimized for this function (start collapsed)
      setOverviewWindowStates(prev => {
        const newMap = new Map(prev);
        newMap.set(funcName, 'minimized');
        return newMap;
      });
      // Set initial position on the right side
      setWindowPositions(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(funcName)) {
          // Calculate initial position - stack vertically
          const existingWindows = Array.from(newMap.keys()).length;
          newMap.set(funcName, { x: 0, y: 16 + existingWindows * 420 });
        }
        return newMap;
      });
    }
    
    // Also update selectedFunction for overview panel
    setSelectedFunction(funcName);
    setCallGraphSearchName(funcName);
  };

  const handleMouseDown = (e, funcName) => {
    // Y offset: edge filter button group (top:10 + height:~41) + gap(10) = 61, rounded to 60
    const position = windowPositions.get(funcName) || { x: 0, y: 60 };
    setDraggedWindow({
      funcName,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: position.x,
      offsetY: position.y,
      hasDragged: false
    });
    // Reset drag flag for this window
    setWasDragged(prev => {
      const newMap = new Map(prev);
      newMap.set(funcName, false);
      return newMap;
    });
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    if (!draggedWindow) return;
    
    const deltaX = e.clientX - draggedWindow.startX;
    const deltaY = e.clientY - draggedWindow.startY;
    
    // Check if mouse moved more than 5 pixels (consider it a drag)
    const movedDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const hasDragged = movedDistance > 5;
    
    if (hasDragged && !draggedWindow.hasDragged) {
      setDraggedWindow(prev => prev ? { ...prev, hasDragged: true } : null);
    }
    
    // Edge filter button group: top(10) + height(41) + gap(9) = 60px minimum
    const EDGE_FILTER_BUTTON_HEIGHT = 60;
    const newY = draggedWindow.offsetY + deltaY;

    setWindowPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(draggedWindow.funcName, {
        // 가로 위치는 고정(좌/우 특정 영역), 세로만 드래그로 이동 가능
        x: 0,
        y: Math.max(newY, EDGE_FILTER_BUTTON_HEIGHT) // Prevent dragging above button group
      });
      return newMap;
    });
  }, [draggedWindow]);

  const handleMouseUp = useCallback(() => {
    const funcName = draggedWindow?.funcName;
    const hadDragged = draggedWindow?.hasDragged || false;
    
    if (funcName) {
      setWasDragged(prev => {
        const newMap = new Map(prev);
        newMap.set(funcName, hadDragged);
        return newMap;
      });
    }
    
    setDraggedWindow(null);
  }, [draggedWindow]);

  useEffect(() => {
    if (draggedWindow) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedWindow, handleMouseMove, handleMouseUp]);

  // 그래프 모드에서 함수 2개가 선택된 경우,
  // 각 함수의 overview 막대를 각 창(왼쪽/오른쪽) 내 동일한 Y 위치에서 시작하도록 정렬
  useEffect(() => {
    if (graphViewMode !== 'graph') return;
    if (manualSelection.length !== 2) return;

    const EDGE_FILTER_BUTTON_HEIGHT = 60;
    const baseY = EDGE_FILTER_BUTTON_HEIGHT + 8;

    setWindowPositions((prev) => {
      const newMap = new Map(prev);
      manualSelection.forEach((name) => {
        newMap.set(name, { x: 0, y: baseY });
      });
      return newMap;
    });
  }, [graphViewMode, manualSelection]);

  // Get all functions that should show overview windows (from manualSelection)
  const functionsToShow = useMemo(() => {
    return manualSelection.map(funcName => {
      const funcMeta = functionsWithMetrics.find(f => f.name === funcName);
      return funcMeta ? { name: funcName, meta: funcMeta } : null;
    }).filter(Boolean);
  }, [manualSelection, functionsWithMetrics]);

  // Backend 모드에서 GitHub URL 기반 Call Graph 타이틀 생성
  const graphTitle = useMemo(() => {
    if (!usingBackend) return 'SQLite Call Graph';
    if (!githubUrl || !githubUrl.trim()) return 'Backend Call Graph';
    try {
      const url = new URL(githubUrl.trim());
      const repoPath = url.pathname
        .replace(/\/$/, '')
        .replace(/\.git$/, '');
      const segments = repoPath.split('/').filter(Boolean);
      const repoName = segments[segments.length - 1] || 'Repository';
      return `${repoName} Call Graph`;
    } catch {
      return 'Backend Call Graph';
    }
  }, [usingBackend, githubUrl]);
  const handleOverviewToggle = (funcName) => {
    if (!funcName) return;
    setOverviewWindowStates((prev) => {
      const map = new Map(prev);
      const current = map.get(funcName);
      if (current === 'maximized') {
        map.delete(funcName);
        setWindowPositions((prevPos) => {
          const nextPos = new Map(prevPos);
          nextPos.delete(funcName);
          return nextPos;
        });
      } else {
        map.set(funcName, 'maximized');
        setWindowPositions((prevPos) => {
          const nextPos = new Map(prevPos);
          if (!nextPos.has(funcName)) {
            nextPos.set(funcName, { x: 0, y: 68 });
          }
          return nextPos;
        });
      }
      return map;
    });
  };

  const selectedPresetMeta = PRESETS.find(preset => preset.id === selectedPreset) || {};

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] bg-gray-50 relative">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-lg shadow-lg border-2 ${
            notification.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          } transition-all duration-300`}
          style={{
            animation: 'slideDown 0.3s ease-out'
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {notification.type === 'error' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}
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
                      <div className="flex items-center gap-1">
                        <h2 className="text-lg font-semibold text-gray-900">탐색 기준 Preset</h2>
                        <div className="relative group inline-block">
                          <button
                            type="button"
                            className="w-4 h-4 flex items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500 bg-white hover:bg-gray-100"
                            aria-label="탐색 기준 Preset 정렬 기준 안내"
                          >
                            i
                          </button>
                          <div className="fixed top-24 left-6 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-[11px] text-gray-700 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none">
                            <div className="font-semibold text-gray-900 mb-1">
                              Preset별 정렬 기준
                            </div>
                            <div className="mb-1">
                              <span className="font-semibold text-xs text-blue-700">High Complexity</span>
                              <ul className="list-disc list-inside mt-0.5">
                                <li>최소 경고 수와 최소 degree 조건을 만족하는 함수만 표시됩니다.</li>
                                <li>집중할 심각도(High/Medium/Low)를 선택하면 해당 심각도 경고가 1개 이상 있는 함수만 남습니다.</li>
                                <li>이후 CCN(복잡도)이 높은 함수부터 내림차순으로 정렬됩니다.</li>
                              </ul>
                            </div>
                            <div className="mb-1">
                              <span className="font-semibold text-xs text-red-700">Risky Warnings</span>
                              <ul className="list-disc list-inside mt-0.5">
                                <li>최소 복잡도와 최소 경고 수 조건을 만족하는 함수만 표시됩니다.</li>
                                <li>High 심각도 경고 개수가 많은 함수일수록 위에 오도록 내림차순으로 정렬됩니다.</li>
                              </ul>
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-green-700">Easy Fixes</span>
                              <ul className="list-disc list-inside mt-0.5">
                                <li>낮은 심각도(Low) 경고 개수가 설정한 Easy-to-fix 기준 이상인 함수만 표시됩니다.</li>
                                <li>최대 복잡도를 제한하면 그 값 이하의 함수만 남습니다.</li>
                                <li>Easy-to-fix 경고 개수가 많은 함수부터 내림차순으로 정렬됩니다.</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
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

                {/* Filter Section - Moved here from above call graph */}
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">필터</h3>
                    <div className="flex flex-wrap gap-2">
                      {FILTER_CONFIG[selectedPreset]?.map(filter => (
                        <div key={filter.key} className="flex flex-col text-xs gap-1 w-full">
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
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">함수 목록</h3>
                        <button
                          type="button"
                          onClick={() => setIsHistoryMode(prev => !prev)}
                          className={`text-[11px] px-2 py-1 rounded border ${
                            isHistoryMode
                              ? 'border-blue-500 text-blue-700 bg-blue-50'
                              : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
                          }`}
                        >
                          선택 기록
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {manualSelection.length > 0 && (
                          <button
                            onClick={() => {
                              setManualSelection([]);
                              setSelectedFunction(null);
                              setOverviewWindowStates(new Map());
                            }}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Clear
                          </button>
                        )}
                        <span className="text-xs text-gray-500">{filteredFunctions.length}개 함수</span>
                      </div>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="mb-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={functionSearchQuery}
                          onChange={(e) => setFunctionSearchQuery(e.target.value)}
                          placeholder="함수 이름 또는 파일로 검색..."
                          className="w-full px-3 py-2 pl-9 pr-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <svg
                          className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {functionSearchQuery && (
                          <button
                            onClick={() => setFunctionSearchQuery('')}
                            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-gray-400 mb-2">
                      {graphViewMode === 'radar_heatmap'
                        ? '함수를 클릭하면 Radar/Heatmap에 사용할 함수가 선택됩니다. 최소 2개, 최대 5개까지 선택할 수 있습니다.'
                        : '함수를 클릭하면 서브그래프가 표시됩니다. 최대 2개까지 선택하여 비교할 수 있습니다.'}
                      {manualSelection.length > 0 && (
                        <span className="block mt-1 text-blue-600 font-medium">
                          선택됨: {manualSelection.length}/{graphViewMode === 'radar_heatmap' ? 5 : 2}
                        </span>
                      )}
                    </div>
                    {/* Sorting Indicator */}
                    {!isHistoryMode && (
                      <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-blue-900">정렬 기준:</span>
                          <span className="text-[10px] text-blue-800">
                            {selectedPreset === 'complexity' && (
                              <span className="inline-flex items-center gap-1">
                                <span className="px-1.5 py-0.5 bg-blue-200 text-blue-900 rounded font-bold text-[10px]">CC (복잡도)</span>
                                <span className="text-blue-600">높은 순</span>
                              </span>
                            )}
                            {selectedPreset === 'severity' && (
                              <span className="inline-flex items-center gap-1">
                                <span className="px-1.5 py-0.5 bg-red-200 text-red-900 rounded font-bold text-[10px]">H (High 경고)</span>
                                <span className="text-blue-600">많은 순</span>
                              </span>
                            )}
                            {selectedPreset === 'easy' && (
                              <span className="inline-flex items-center gap-1">
                                <span className="px-1.5 py-0.5 bg-green-200 text-green-900 rounded font-bold text-[10px]">E (Easy Fix)</span>
                                <span className="text-blue-600">많은 순</span>
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                      {mode === 'backend' && (!backendFunctions || backendFunctions.length === 0) && (
                        <div className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg p-4 text-center mb-2">
                          Enter a Git repository URL and run the analysis to load functions.
                        </div>
                      )}
                      {isHistoryMode && selectionHistory.length === 0 && (
                        <div className="text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-lg p-3 text-center mb-2">
                          아직 선택된 함수가 없습니다. 함수 목록에서 함수를 선택하면 최근 선택 기록이 여기에 표시됩니다.
                        </div>
                      )}
                      {(isHistoryMode
                        ? selectionHistory
                            .map(name => functionsWithMetrics.find(f => f.name === name))
                            .filter(Boolean)
                        : filteredFunctions
                      ).map(func => {
                        const isInSubgraphSelection = manualSelection.includes(func.name);
                        const isSelectedForOverview = selectedFunction === func.name;
                        const selectionIndex = manualSelection.indexOf(func.name);
                        
                        // Determine which metric is being used for sorting
                        const isComplexitySort = selectedPreset === 'complexity';
                        const isSeveritySort = selectedPreset === 'severity';
                        const isEasySort = selectedPreset === 'easy';
                        
                        return (
                          <div
                            key={func.id}
                            className={`rounded-lg border p-2 transition-all cursor-pointer ${
                              isInSubgraphSelection
                                ? selectionIndex === 0
                                  ? 'bg-blue-100 border-blue-400 shadow-md'
                                  : 'bg-green-100 border-green-400 shadow-md'
                                : isSelectedForOverview
                                  ? 'bg-gray-200 border-gray-300 shadow-sm'
                                  : 'bg-white border-gray-200 hover:border-primary hover:shadow-sm'
                            }`}
                            onClick={() => handleFunctionSelect(func.name)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {isInSubgraphSelection && (
                                    <span className={`text-xs font-bold ${
                                      selectionIndex === 0 ? 'text-blue-700' : 'text-green-700'
                                    }`}>
                                      [{selectionIndex + 1}]
                                    </span>
                                  )}
                                  <h4 className={`text-xs font-semibold truncate ${
                                    isInSubgraphSelection || isSelectedForOverview ? 'text-gray-900' : 'text-gray-900'
                                  }`}>
                                    {func.name}
                                  </h4>
                                </div>
                                <p className={`text-[10px] truncate ${
                                  isInSubgraphSelection || isSelectedForOverview ? 'text-gray-600' : 'text-gray-500'
                                }`}>
                                  {func.file}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className={`text-right px-2 py-1 rounded ${
                                  isComplexitySort
                                    ? 'bg-blue-100 border-2 border-blue-400'
                                    : ''
                                }`}>
                                  <div className={`text-[10px] font-medium ${
                                    isComplexitySort 
                                      ? 'text-blue-700 font-bold' 
                                      : isInSubgraphSelection || isSelectedForOverview 
                                        ? 'text-gray-600' 
                                        : 'text-gray-400'
                                  }`}>
                                    CC
                                  </div>
                                  <div className={`text-sm font-bold ${
                                    isComplexitySort
                                      ? 'text-blue-900'
                                      : isInSubgraphSelection || isSelectedForOverview 
                                        ? 'text-gray-900' 
                                        : 'text-gray-900'
                                  }`}>
                                    {func.complexity}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              <div className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                isInSubgraphSelection || isSelectedForOverview
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-gray-50 text-gray-600'
                              }`}>
                                경고 {func.warningCount}
                              </div>
                              <div className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                isInSubgraphSelection || isSelectedForOverview
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-gray-50 text-gray-600'
                              }`}>
                                D {func.degree}
                              </div>
                              <div className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                isEasySort
                                  ? (isInSubgraphSelection || isSelectedForOverview
                                      ? 'bg-green-200 text-green-900 border-2 border-green-400'
                                      : 'bg-green-100 text-green-900 border-2 border-green-300')
                                  : isInSubgraphSelection || isSelectedForOverview
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-gray-50 text-gray-600'
                              }`}>
                                E {func.easyFixCount}
                              </div>
                              {['High', 'Medium', 'Low'].map(level =>
                                func.severityCounts[level] ? (
                                  <span
                                    key={level}
                                    className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border-2 ${
                                      isSeveritySort && level === 'High'
                                        ? (isInSubgraphSelection || isSelectedForOverview
                                            ? 'bg-red-200 text-red-900 border-red-400'
                                            : 'bg-red-100 text-red-900 border-red-300')
                                        : isInSubgraphSelection || isSelectedForOverview
                                          ? 'bg-gray-100 text-gray-700 border-gray-300'
                                          : 'bg-gray-50 text-gray-600 border-gray-200'
                                    }`}
                                  >
                                    {level[0]} {func.severityCounts[level]}
                                  </span>
                                ) : null
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {filteredFunctions.length === 0 && !(mode === 'backend' && (!backendFunctions || backendFunctions.length === 0)) && (
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
        <div className={`flex ${isPresetPanelOpen ? 'lg:w-3/4' : 'lg:w-full'} bg-white overflow-hidden transition-all duration-300`}>
          {/* Call Graph Section */}
          <div className="flex flex-col px-5 py-1 flex-1 min-w-0 relative">
            <div className="mb-1 flex flex-col gap-1 md:flex-row md:items-center md:space-x-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">
                  {graphViewMode === 'graph' ? 'Call Graph Visualization' : 'Radar Chart / Heatmap'}
                </h2>
                {mode === 'backend' && (
                  <div className="relative group">
                    <button
                      type="button"
                      aria-label="Refresh warning"
                      className="w-6 h-6 rounded-full border border-yellow-300 text-xs font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                    >
                      !
                    </button>
                    <div className="fixed top-28 right-8 hidden w-72 rounded-lg border border-yellow-200 bg-white p-3 text-xs text-gray-700 shadow-lg group-hover:flex group-focus-within:flex z-50 pointer-events-none">
                      <div className="font-semibold mb-1 text-yellow-800">Refresh notice</div>
                      <p className="leading-snug">
                        Refreshing or closing the page will clear the current backend call graph and analysis data. 
                        If you need this view again, you&apos;ll have to rerun the analysis.
                      </p>
                    </div>
                  </div>
                )}
                {mode === 'backend' && (
                  <div className="relative group">
                    <button
                      type="button"
                      aria-label="View backend data"
                      className="w-6 h-6 rounded-full border border-blue-300 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => setIsDataViewerOpen(prev => !prev)}
                    >
                      ↓
                    </button>
                    <div className="fixed top-36 right-8 hidden w-72 rounded-lg border border-blue-200 bg-white p-3 text-xs text-gray-700 shadow-lg group-hover:flex group-focus-within:flex z-50 pointer-events-none">
                      <div className="font-semibold mb-1 text-blue-800">Backend data viewer</div>
                      <p className="leading-snug">
                        Click to toggle the viewer for backend <code>cg</code>, <code>functions</code>, and <code>warnings</code> JSON. 
                        Data is stored only in memory and will be cleared on refresh.
                      </p>
                    </div>
                  </div>
                )}
                {manualSelection.length > 0 && graphViewMode === 'graph' && (
                  <div className="ml-1 text-xs text-gray-500">
                    서브그래프:{' '}
                    {manualSelection.map((name, idx) => (
                      <span key={idx} className={`font-semibold ${idx === 0 ? 'text-blue-700' : 'text-green-700'}`}>
                        {name}{idx < manualSelection.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
                {manualSelection.length > 0 && graphViewMode === 'radar_heatmap' && (
                  <div className="ml-1 text-xs text-gray-500 flex items-center">
                    <span className="mr-1">선택된 함수:</span>
                    <div className="max-w-xs md:max-w-sm lg:max-w-md overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      {manualSelection.map((name, idx) => (
                        <span key={idx} className="font-semibold text-blue-700 mr-2">
                          {name}
                          {idx < manualSelection.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedFunction && manualSelection.length === 0 && (
                  <div className="ml-1 text-xs text-gray-500">
                    선택된 함수:{' '}
                    <span className="font-semibold text-gray-900">
                      {selectedFunction}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                <button
                  onClick={() => {
                    setManualSelection([]);
                    setSelectedFunction(null);
                    setOverviewWindowStates(new Map());
                    setWindowPositions(new Map());
                    setCallGraphSearchName('');
                    setGraphResetCounter((prev) => prev + 1);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {graphViewMode === 'graph' ? '그래프 초기화' : '선택 함수 초기화'}
                </button>
                <button
                  onClick={() => {
                    const nextMode = graphViewMode === 'graph' ? 'radar_heatmap' : 'graph';

                    // Backend 모드에서 radar/heatmap으로 전환 시 데이터 유효성 검사
                    if (
                      nextMode === 'radar_heatmap' &&
                      usingBackend &&
                      (
                        !backendFunctions ||
                        backendFunctions.length === 0 ||
                        !backendWarnings ||
                        backendWarnings.length === 0
                      )
                    ) {
                      setNotification({
                        message:
                          'Backend 모드에서 Radar/Heatmap을 사용하려면 functions 및 warnings 데이터가 필요합니다. 먼저 GitHub 저장소 분석을 완료해 주세요.',
                        type: 'error',
                      });
                      setTimeout(() => setNotification(null), 4000);
                      return;
                    }

                    setGraphViewMode(prev => {
                      const next = prev === 'graph' ? 'radar_heatmap' : 'graph';
                      if (next === 'graph') {
                        // Radar/Heatmap -> Call graph: 선택 함수 초기화 및 기본 그래프로 전환
                        setManualSelection([]);
                        setSelectedFunction(null);
                        setOverviewWindowStates(new Map());
                        setWindowPositions(new Map());
                        setCallGraphSearchName('');
                      } else {
                        // Call graph -> Radar/Heatmap: 기존 선택 상태 초기화
                        setManualSelection([]);
                        setSelectedFunction(null);
                        setOverviewWindowStates(new Map());
                        setWindowPositions(new Map());
                      }
                      return next;
                    });
                  }}
                  className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {graphViewMode === 'graph' ? 'radar/heatmap' : 'call graph'}
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              {/* Function Overview Windows - 카드 형태로만 표시 (막대기 제거) */}
              {graphViewMode === 'graph' && manualSelection.map((funcName) => {
                const funcMeta = functionsWithMetrics.find(f => f.name === funcName);
                const windowState = overviewWindowStates.get(funcName);
                if (!funcMeta || windowState !== 'maximized') return null;

                // Edge filter button group: top(10) + height(41) + gap(9) = 60px minimum
                const EDGE_FILTER_BUTTON_HEIGHT = 60;
                const position = windowPositions.get(funcName) || { x: 0, y: EDGE_FILTER_BUTTON_HEIGHT };
                // Enforce minimum Y to avoid overlap with edge filter buttons
                const safeY = Math.max(position.y, EDGE_FILTER_BUTTON_HEIGHT);

                const selectionIndex = manualSelection.indexOf(funcName);
                const isFirst = selectionIndex === 0;
                const isSecond = selectionIndex === 1;

                const baseStyle = { top: `${safeY}px` };
                const style =
                  manualSelection.length === 1 || isFirst
                    ? { ...baseStyle, left: '16px' }
                    : isSecond
                      ? { ...baseStyle, right: '16px' }
                      : { ...baseStyle, right: '16px' };

                return (
                  <div
                    key={funcName}
                    className="absolute z-30 bg-white border border-gray-200 rounded-lg shadow-xl w-96 max-w-[calc(100%-2rem)]"
                    style={style}
                  >
                    <div 
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white cursor-move"
                      onMouseDown={(e) => handleMouseDown(e, funcName)}
                    >
                      <h2 className="text-lg font-semibold text-gray-900">Function Overview</h2>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setOverviewWindowStates(prev => {
                              const newMap = new Map(prev);
                              newMap.set(funcName, 'minimized');
                              return newMap;
                            });
                          }}
                          className="text-gray-400 hover:text-gray-600 text-sm px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                          title="Minimize"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-6">
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-2 text-lg">{funcMeta.name}</h3>
                        {funcMeta.description && (
                          <p className="text-sm text-gray-600 mb-4 leading-relaxed">{funcMeta.description}</p>
                        )}
                        
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-500">Complexity:</span>
                            <span className={`font-medium px-2 py-1 rounded ${
                              funcMeta.complexity > 15 ? 'bg-red-100 text-red-800' :
                              funcMeta.complexity > 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {funcMeta.complexity}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-500">Call Count:</span>
                            <span className="font-medium">{funcMeta.callCount}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-500">Warnings:</span>
                            <span className="font-medium">{funcMeta.warningCount}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-100">
                            <span className="text-gray-500">Degree:</span>
                            <span className="font-medium">{funcMeta.degree}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-gray-500">File:</span>
                            <span className="font-medium text-xs text-gray-700">{funcMeta.file}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Warning Breakdown</h4>
                        <div className="space-y-2">
                          {['High', 'Medium', 'Low'].map(severity => {
                            const count = funcMeta.severityCounts[severity] || 0;
                            return count > 0 && (
                              <div key={severity} className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    severity === 'High' ? 'bg-red-500' :
                                    severity === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                  }`}></div>
                                  <span className="text-gray-600 text-sm">{severity}</span>
                                </div>
                                <span className="font-semibold">{count}</span>
                              </div>
                            );
                          })}
                          {funcMeta.warningCount === 0 && (
                            <div className="text-center text-green-600 py-2 text-sm">
                              ✅ No warnings detected
                            </div>
                          )}
                        </div>
                      </div>

                      {funcMeta.warnings && funcMeta.warnings.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Warnings</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {funcMeta.warnings.slice(0, 5).map((warning) => (
                              <div
                                key={warning.id}
                                className={`border-l-4 pl-3 py-2 text-xs ${
                                  warning.severity === 'High' ? 'border-red-500 bg-red-50' :
                                  warning.severity === 'Medium' ? 'border-yellow-500 bg-yellow-50' :
                                  'border-blue-500 bg-blue-50'
                                }`}
                              >
                                <div className="font-medium text-gray-900">{warning.type}</div>
                                <div className="text-gray-600 mt-1">{warning.description}</div>
                                <div className="text-gray-500 mt-1">{warning.file}:{warning.line}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {mode === 'backend' && isDataViewerOpen && (
                <div className="absolute top-2 right-2 z-20 w-full max-w-xl">
                  <div className="rounded-lg border border-gray-300 bg-white shadow-md">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">
                          Backend JSON data
                        </span>
                        <select
                          value={selectedDataType}
                          onChange={(e) => setSelectedDataType(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                        >
                          <option value="cg">cg (call graph)</option>
                          <option value="functions">functions</option>
                          <option value="warnings">warnings</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsDataViewerOpen(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                    </div>
                    <div className="px-3 py-2 border-b border-gray-200">
                      <p className="text-[11px] text-gray-600">
                        Data is kept only in memory for this session. Refreshing the page will clear these results.
                      </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto bg-gray-900 text-gray-100 px-3 py-2 text-[11px] leading-snug font-mono rounded-b-lg">
                      {(() => {
                        let data = null;
                        if (selectedDataType === 'cg') data = backendCg;
                        else if (selectedDataType === 'functions') data = backendFunctions;
                        else if (selectedDataType === 'warnings') data = backendWarnings;

                        if (!data) {
                          return (
                            <div className="text-gray-400">
                              No backend {selectedDataType} data loaded yet. Run the analysis to load data.
                            </div>
                          );
                        }

                        try {
                          const jsonText = JSON.stringify(data, null, 2);
                          const limit = 8000;
                          const truncated =
                            jsonText.length > limit
                              ? `${jsonText.slice(0, limit)}\n... (truncated)`
                              : jsonText;
                          return (
                            <pre className="whitespace-pre-wrap break-words">
                              {truncated}
                            </pre>
                          );
                        } catch (e) {
                          return (
                            <div className="text-red-300">
                              Failed to stringify data: {e instanceof Error ? e.message : String(e)}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )}
              <div className="w-full h-full min-h-[480px] border border-gray-200 rounded-lg overflow-hidden">
                {graphViewMode === 'graph' ? (
                  mode === 'backend' && !backendGraphLoaded ? (
                    <div className="w-full h-full flex items-center justify-center px-4 text-center text-sm text-gray-500">
                      Enter the Git repository URL to extract the call graph.
                    </div>
                  ) : (modeJustChanged ? 0 : manualSelection.length) === 2 ? (
                    <div className="w-full h-full flex">
                      <div className="w-1/2 h-full border-r border-gray-200">
                        <CallGraphWebGL
                          key={`${mode}-${graphResetCounter}-${manualSelection[0] || 'left'}`}
                          searchFunctionName={modeJustChanged ? '' : manualSelection[0]}
                          graphData={mode === 'backend' ? backendCg : null}
                          title={graphTitle}
                          onToggleOverview={handleOverviewToggle}
                          isOverviewOpen={overviewWindowStates.get(manualSelection[0]) === 'maximized'}
                        />
                      </div>
                      <div className="w-1/2 h-full">
                        <CallGraphWebGL
                          key={`${mode}-${graphResetCounter}-${manualSelection[1] || 'right'}`}
                          searchFunctionName={modeJustChanged ? '' : manualSelection[1]}
                          graphData={mode === 'backend' ? backendCg : null}
                          title={graphTitle}
                          onToggleOverview={handleOverviewToggle}
                          isOverviewOpen={overviewWindowStates.get(manualSelection[1]) === 'maximized'}
                        />
                      </div>
                    </div>
                  ) : (
                    <CallGraphWebGL
                      key={
                        mode === 'backend'
                          ? `backend-single-${graphResetCounter}`
                          : `local-single-${graphResetCounter}`
                      }
                      searchFunctionName={
                        modeJustChanged
                          ? ''
                          : manualSelection.length === 1
                            ? manualSelection[0]
                            : callGraphSearchName
                      }
                      graphData={mode === 'backend' ? backendCg : null}
                      title={graphTitle}
                      onToggleOverview={handleOverviewToggle}
                      isOverviewOpen={
                        (manualSelection.length === 1
                          ? overviewWindowStates.get(manualSelection[0])
                          : overviewWindowStates.get(callGraphSearchName || '')) === 'maximized'
                      }
                    />
                  )
                ) : usingBackend && (!backendFunctions || backendFunctions.length === 0) ? (
                  <div className="w-full h-full flex items-center justify-center px-4 text-center text-sm text-gray-500">
                    Enter the Git repository URL and run the analysis to load functions for radar/heatmap view.
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col lg:flex-row">
                    <div className="w-full lg:w-1/2 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-200 p-4">
                      <RadarChart
                        functions={manualSelection
                          .map(name => functionsWithMetrics.find(f => f.name === name))
                          .filter(Boolean)}
                      />
                    </div>
                    <div className="w-full lg:w-1/2 h-1/2 lg:h-full p-4">
                      <MetricsHeatmap
                        functions={manualSelection
                          .map(name => functionsWithMetrics.find(f => f.name === name))
                          .filter(Boolean)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WarningsPage;

import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import WarningsPage from './pages/WarningsPage';
import CallGraphPage from './pages/CallGraphPage';
import ComparisonPage from './pages/ComparisonPage';
import './index.css';

function App() {
  // 모드: 'local' | 'backend'
  const [mode, setMode] = useState('local');
  // Backend 모드에서 사용할 GitHub URL
  const [githubUrl, setGithubUrl] = useState('');
  // Backend 모드에서 call graph 데이터가 준비되었는지 여부
  const [backendGraphLoaded, setBackendGraphLoaded] = useState(false);
  // Backend 모드에서 사용할 데이터
  const [backendFunctions, setBackendFunctions] = useState(null);
  const [backendWarnings, setBackendWarnings] = useState(null);
  const [backendCg, setBackendCg] = useState(null);
  // Backend 파이프라인 실행 상태
  const [backendTaskId, setBackendTaskId] = useState(null);
  const [backendStep, setBackendStep] = useState(null); // CLONING, CLANG, ...
  const [backendStatus, setBackendStatus] = useState(null); // { status, message }
  const [backendError, setBackendError] = useState(null); // { step, endpoint, message }
  const [isBackendRunning, setIsBackendRunning] = useState(false);
  const [backendLogs, setBackendLogs] = useState([]); // 현재 실행에 대한 로그
  const [backendLogHistory, setBackendLogHistory] = useState([]); // 이전 실행 로그 세션들 [{ taskId, logs, startedAt }]
  const [selectedLogIndex, setSelectedLogIndex] = useState(null); // null = 현재 실행, 0..n-1 = history 인덱스
  const [backendLastResponse, setBackendLastResponse] = useState(null); // 마지막 JSON 응답 내용

  const BACKEND_BASE_URL = 'https://infovis-server.fly.dev';

  const resetBackendState = () => {
    setBackendGraphLoaded(false);
    setBackendFunctions(null);
    setBackendWarnings(null);
    setBackendCg(null);
    setBackendTaskId(null);
    setBackendStep(null);
    setBackendStatus(null);
    setBackendError(null);
    setIsBackendRunning(false);
    setBackendLogs([]);
    setBackendLogHistory([]);
    setSelectedLogIndex(null);
    setBackendLastResponse(null);
  };

  const appendBackendLog = (entry) => {
    setBackendLogs((prev) => [
      ...prev,
      {
        ...entry,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const pollTaskStatus = async (taskId, expectedStep, endpointLabel) => {
    const timeoutMs = 600_000; // 10 minutes per step
    const intervalMs = 1500;
    const startTime = Date.now();
    const statusEndpoint = `${BACKEND_BASE_URL}/api/tasks/${taskId}/status/`;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        appendBackendLog({
          step: expectedStep,
          endpoint: statusEndpoint,
          level: 'ERROR',
          message: `Timeout after ${Math.round(timeoutMs / 1000)} seconds while waiting for ${endpointLabel}.`,
        });
        setBackendError({
          step: expectedStep,
          endpoint: statusEndpoint,
          message: `Timeout after ${Math.round(timeoutMs / 1000)} seconds while waiting for ${endpointLabel}.`,
        });
        throw new Error('Backend step timeout');
      }

      let data;
      try {
        const res = await fetch(statusEndpoint);
        data = await res.json();
      } catch (err) {
        appendBackendLog({
          step: expectedStep,
          endpoint: statusEndpoint,
          level: 'ERROR',
          message: `Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`,
        });
        setBackendError({
          step: expectedStep,
          endpoint: statusEndpoint,
          message: `Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`,
        });
        throw err;
      }

      const { status, current_step, message } = data || {};
      setBackendStatus({ status, message });
      setBackendLastResponse({
        step: current_step || expectedStep,
        endpoint: statusEndpoint,
        data,
        timestamp: new Date().toISOString(),
      });

      if (status === 'FAILED') {
        appendBackendLog({
          step: current_step || expectedStep,
          endpoint: statusEndpoint,
          level: 'ERROR',
          message: message || 'Step failed on server.',
        });
        setBackendError({
          step: current_step || expectedStep,
          endpoint: statusEndpoint,
          message: message || 'Step failed on server.',
        });
        throw new Error('Backend step failed');
      }

      if (status === 'COMPLETED' && (!expectedStep || current_step === expectedStep)) {
        appendBackendLog({
          step: current_step || expectedStep,
          endpoint: statusEndpoint,
          level: 'INFO',
          message: `${endpointLabel} completed (status: COMPLETED).`,
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  };

  const runBackendStep = async (taskId, taskName, stepKey, displayLabel) => {
    const endpoint = `${BACKEND_BASE_URL}/api/tasks/${taskId}/run/${taskName}/`;
    setBackendStep(stepKey);
    setBackendStatus({
      status: 'RUNNING',
      message: `${displayLabel} Please wait...`,
    });

    appendBackendLog({
      step: stepKey,
      endpoint,
      level: 'INFO',
      message: `POST ${endpoint} start`,
    });

    let data;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      data = await res.json();
      if (!res.ok) {
        const msg = data?.message || `Request failed with status ${res.status}`;
        appendBackendLog({
          step: stepKey,
          endpoint,
          level: 'ERROR',
          message: msg,
        });
        setBackendError({
          step: stepKey,
          endpoint,
          message: msg,
        });
        throw new Error(msg);
      }
      setBackendLastResponse({
        step: stepKey,
        endpoint,
        data,
        timestamp: new Date().toISOString(),
      });
      appendBackendLog({
        step: stepKey,
        endpoint,
        level: 'INFO',
        message: data?.message || `Step '${taskName}' accepted (status: ${res.status}).`,
      });
    } catch (err) {
      if (!backendError) {
        setBackendError({
          step: stepKey,
          endpoint,
          message: data?.message || (err instanceof Error ? err.message : String(err)),
        });
      }
      throw err;
    }

    await pollTaskStatus(taskId, stepKey, displayLabel);
  };

  const fetchBackendJson = async (taskId, dataName, label) => {
    const endpoint = `${BACKEND_BASE_URL}/api/tasks/${taskId}/${dataName}/`;
    try {
      appendBackendLog({
        step: label,
        endpoint,
        level: 'INFO',
        message: `GET ${endpoint} start`,
      });
      const res = await fetch(endpoint);
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message || `Failed to load ${label} (status ${res.status})`;
        appendBackendLog({
          step: label,
          endpoint,
          level: 'ERROR',
          message: msg,
        });
        setBackendError({
          step: label,
          endpoint,
          message: msg,
        });
        throw new Error(msg);
      }
      setBackendLastResponse({
        step: label,
        endpoint,
        data,
        timestamp: new Date().toISOString(),
      });
      const sizeHint = Array.isArray(data)
        ? `${data.length} items`
        : typeof data === 'object' && data !== null
          ? `${Object.keys(data).length} keys`
          : typeof data;
      appendBackendLog({
        step: label,
        endpoint,
        level: 'INFO',
        message: `Loaded ${label} successfully (${sizeHint}).`,
      });
      return data;
    } catch (err) {
      appendBackendLog({
        step: label,
        endpoint,
        level: 'ERROR',
        message: err instanceof Error ? err.message : String(err),
      });
      if (!backendError) {
        setBackendError({
          step: label,
          endpoint,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  };

  const runBackendPipeline = async () => {
    if (isBackendRunning) return;
    if (!githubUrl || !githubUrl.trim()) {
      setBackendError({
        step: 'START',
        endpoint: `${BACKEND_BASE_URL}/api/tasks/start/`,
        message: 'GitHub repository URL is required.',
      });
      return;
    }

    setIsBackendRunning(true);
    setBackendError(null);
    // 이전 실행 로그를 history에 보관
    setBackendLogHistory((prev) =>
      backendLogs.length > 0
        ? [
            ...prev,
            {
              taskId: backendTaskId,
              logs: backendLogs,
              startedAt: backendLogs[0]?.timestamp || new Date().toISOString(),
            },
          ]
        : prev,
    );
    setSelectedLogIndex(null);
    setBackendGraphLoaded(false);
    setBackendFunctions(null);
    setBackendWarnings(null);
    setBackendCg(null);
    setBackendLogs([]);

    try {
      // 1. Create task & Git clone
      setBackendStep('CLONING');
      setBackendStatus({
        status: 'RUNNING',
        message: 'Cloning repository via Git. Please wait...',
      });

      const startEndpoint = `${BACKEND_BASE_URL}/api/tasks/start/`;
      let startData;
      appendBackendLog({
        step: 'CLONING',
        endpoint: startEndpoint,
        level: 'INFO',
        message: `POST ${startEndpoint} start (github_url=${githubUrl.trim()})`,
      });
      const startRes = await fetch(startEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: githubUrl.trim() }),
      });
      try {
        startData = await startRes.json();
      } catch {
        startData = null;
      }
      if (!startRes.ok || !startData?.task_id) {
        const msg = startData?.message || `Failed to start task (status ${startRes.status})`;
        appendBackendLog({
          step: 'CLONING',
          endpoint: startEndpoint,
          level: 'ERROR',
          message: msg,
        });
        setBackendError({
          step: 'CLONING',
          endpoint: startEndpoint,
          message: msg,
        });
        throw new Error(msg);
      }

      const taskId = startData.task_id;
      setBackendTaskId(taskId);
      appendBackendLog({
        step: 'CLONING',
        endpoint: startEndpoint,
        level: 'INFO',
        message: `Task started with id=${taskId}`,
      });

      await pollTaskStatus(taskId, 'CLONING', 'Git cloning');

      // 3. Analysis steps
      await runBackendStep(taskId, 'clang', 'CLANG', 'Running Clang analysis');
      await runBackendStep(taskId, 'cpplint', 'CPPLINT', 'Running Cpplint analysis');
      await runBackendStep(taskId, 'lizard', 'LIZARD', 'Running Lizard analysis');
      await runBackendStep(taskId, 'infer', 'INFER', 'Running Infer analysis');

      // 4. Preprocessing
      await runBackendStep(taskId, 'preprocess', 'PREPROCESSING', 'Running preprocessing');

      // 5. Fetch result data and map to sqlite_* structure
      setBackendStep('FETCHING');
      setBackendStatus({
        status: 'RUNNING',
        message: 'Fetching analysis results from server...',
      });

      const [cgData, warningsData, functionsData] = await Promise.all([
        fetchBackendJson(taskId, 'cg', 'Call graph (cg)'),
        fetchBackendJson(taskId, 'warnings', 'Warnings'),
        fetchBackendJson(taskId, 'functions', 'Functions'),
      ]);

      // Assume backend already returns in compatible schema with sqlite_* files
      setBackendCg(cgData);
      setBackendWarnings(warningsData);
      setBackendFunctions(functionsData);
      setBackendGraphLoaded(true);
      setBackendStatus({
        status: 'COMPLETED',
        message: 'Analysis completed successfully.',
      });

      // 6. Cleanup (best-effort)
      try {
        await runBackendStep(taskId, 'cleanup', 'CLEANUP', 'Cleaning up server resources');
      } catch (cleanupErr) {
        // Cleanup 실패는 치명적이지 않으므로 로그만 남김
        console.error('Cleanup step failed:', cleanupErr);
      }
    } catch (err) {
      console.error('Backend pipeline error:', err);
    } finally {
      setIsBackendRunning(false);
    }
  };

  const hasHistory = backendLogHistory.length > 0;
  const isCurrentSelected = selectedLogIndex === null || !hasHistory;
  const logsToDisplay =
    !hasHistory || isCurrentSelected
      ? backendLogs
      : backendLogHistory[selectedLogIndex]?.logs || [];

  let lastResponseTitle = null;
  let lastResponseEndpoint = null;
  let lastResponseText = null;
  if (backendLastResponse && backendLastResponse.data !== undefined) {
    lastResponseTitle = backendLastResponse.step || '';
    lastResponseEndpoint = backendLastResponse.endpoint || '';
    try {
      const jsonText = JSON.stringify(backendLastResponse.data, null, 2);
      const limit = 8000;
      lastResponseText =
        jsonText.length > limit
          ? `${jsonText.slice(0, limit)}\n... (truncated, full payload available in console or network tab)`
          : jsonText;
    } catch {
      lastResponseText = String(backendLastResponse.data);
    }
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar */}
        <Navbar
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            // 모드가 Backend에서 Local로 돌아올 때는 backend 상태를 초기화
            if (nextMode === 'local') {
              resetBackendState();
            }
          }}
          githubUrl={githubUrl}
          onGithubUrlChange={setGithubUrl}
          onStartBackend={runBackendPipeline}
        />
        
        {/* Main Content Area */}
        <Routes>
          <Route path="/" element={<Navigate to="/warnings" replace />} />
          <Route
            path="/warnings"
            element={
              <WarningsPage
                mode={mode}
                backendGraphLoaded={backendGraphLoaded}
                backendFunctions={backendFunctions}
                backendWarnings={backendWarnings}
                backendCg={backendCg}
              />
            }
          />
          <Route path="/graph/:id" element={<CallGraphPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
        </Routes>

        {/* Backend 모드 로딩/에러 오버레이 */}
        {(isBackendRunning || backendError) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="max-w-2xl w-full mx-4 rounded-xl bg-white shadow-xl border border-gray-200 p-6">
              {backendError ? (
                <>
                  <h2 className="text-lg font-semibold text-red-600 mb-3">
                    Backend pipeline failed
                  </h2>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <span className="font-semibold">Task ID:</span>{' '}
                      <span>{backendTaskId ?? '-'}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Step:</span>{' '}
                      <span>{backendError.step || '-'}</span>
                    </div>
                    <div className="break-all">
                      <span className="font-semibold">Endpoint:</span>{' '}
                      <span className="text-xs text-gray-600">
                        {backendError.endpoint || '-'}
                      </span>
                    </div>
                    <div className="mt-1">
                      <span className="font-semibold">Message:</span>{' '}
                      <span>{backendError.message || '-'}</span>
                    </div>
                  </div>
                  {logsToDisplay.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold text-gray-700">
                          Request / Response log
                        </div>
                        {backendLogHistory.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-600">
                            <span>View run:</span>
                            <select
                              value={
                                selectedLogIndex === null ? 'current' : String(selectedLogIndex)
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedLogIndex(val === 'current' ? null : Number(val));
                              }}
                              className="border border-gray-300 rounded px-1 py-0.5 bg-white"
                            >
                              <option value="current">
                                Current
                                {backendTaskId ? ` (task ${backendTaskId})` : ''}
                              </option>
                              {backendLogHistory.map((session, idx) => (
                                <option key={session.startedAt + idx} value={idx}>
                                  Run #{idx + 1}
                                  {session.taskId ? ` (task ${session.taskId})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-snug font-mono">
                        {logsToDisplay.map((log, idx) => (
                          <div
                            key={`${log.timestamp}-${idx}`}
                            className="mb-1 last:mb-0"
                          >
                            <span className="text-gray-400 mr-1">
                              [{log.step || '-'}]
                            </span>
                            <span
                              className={
                                log.level === 'ERROR'
                                  ? 'text-red-600 font-semibold mr-1'
                                  : 'text-green-700 font-semibold mr-1'
                              }
                            >
                              {log.level}
                            </span>
                            <span className="text-gray-700">
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastResponseText && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Last JSON response {lastResponseTitle && `(${lastResponseTitle})`}
                      </div>
                      {lastResponseEndpoint && (
                        <div className="text-[10px] text-gray-500 mb-1 break-all">
                          {lastResponseEndpoint}
                        </div>
                      )}
                      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-800 bg-gray-900 text-gray-100 px-3 py-2 text-[11px] leading-snug font-mono">
                        <pre className="whitespace-pre-wrap break-words">
                          {lastResponseText}
                        </pre>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBackendLogs([])}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Clear log
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackendError(null)}
                      className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-blue-700"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Running backend analysis
                  </h2>
                  <p className="text-sm text-gray-600 mb-3">
                    {backendStatus?.message ||
                      'Executing analysis pipeline on the server. This may take up to 1–2 minutes.'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Task ID: {backendTaskId ?? '-'}</span>
                    <span>Current step: {backendStep || '-'}</span>
                    <span>Status: {backendStatus?.status || 'RUNNING'}</span>
                  </div>
                  {backendStatus?.message && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      Last message: {backendStatus.message}
                    </div>
                  )}
                  {logsToDisplay.length > 0 && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-semibold text-gray-700">
                          Request / Response log
                        </div>
                        {backendLogHistory.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-gray-600">
                            <span>View run:</span>
                            <select
                              value={
                                selectedLogIndex === null ? 'current' : String(selectedLogIndex)
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedLogIndex(val === 'current' ? null : Number(val));
                              }}
                              className="border border-gray-300 rounded px-1 py-0.5 bg-white"
                            >
                              <option value="current">
                                Current
                                {backendTaskId ? ` (task ${backendTaskId})` : ''}
                              </option>
                              {backendLogHistory.map((session, idx) => (
                                <option key={session.startedAt + idx} value={idx}>
                                  Run #{idx + 1}
                                  {session.taskId ? ` (task ${session.taskId})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] leading-snug font-mono">
                        {logsToDisplay.map((log, idx) => (
                          <div
                            key={`${log.timestamp}-${idx}`}
                            className="mb-1 last:mb-0"
                          >
                            <span className="text-gray-400 mr-1">
                              [{log.step || '-'}]
                            </span>
                            <span
                              className={
                                log.level === 'ERROR'
                                  ? 'text-red-600 font-semibold mr-1'
                                  : 'text-green-700 font-semibold mr-1'
                              }
                            >
                              {log.level}
                            </span>
                            <span className="text-gray-700">
                              {log.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lastResponseText && (
                    <div className="mt-4 border-t border-gray-200 pt-3">
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        Last JSON response {lastResponseTitle && `(${lastResponseTitle})`}
                      </div>
                      {lastResponseEndpoint && (
                        <div className="text-[10px] text-gray-500 mb-1 break-all">
                          {lastResponseEndpoint}
                        </div>
                      )}
                      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-800 bg-gray-900 text-gray-100 px-3 py-2 text-[11px] leading-snug font-mono">
                        <pre className="whitespace-pre-wrap break-words">
                          {lastResponseText}
                        </pre>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;

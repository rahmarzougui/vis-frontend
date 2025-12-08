import { useState } from 'react';

const Navbar = ({
  mode = 'local',
  onModeChange,
  githubUrl = '',
  onGithubUrlChange,
  onStartBackend,
}) => {

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Title / Branding */}
          <div className="flex items-center flex-shrink-0">
            <h1 className="text-2xl font-bold text-gray-900">
              RefaVis
            </h1>
            <span className="ml-2 text-sm text-gray-500 font-medium">
              Refactoring-Aware Visual Analytics
            </span>
          </div>

          {/* Backend 모드에서 중앙 Git URL 입력 + 실행 버튼 */}
          {mode === 'backend' && (
            <div className="flex-1 hidden md:flex items-center justify-center">
              <div className="flex items-center gap-2 max-w-xl w-full">
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) =>
                    onGithubUrlChange && onGithubUrlChange(e.target.value)
                  }
                  placeholder="GitHub repo URL..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => onStartBackend && onStartBackend()}
                  className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Run Analysis
                </button>
              </div>
            </div>
          )}

          {/* 우측 모드 선택 영역 (위치 고정) */}
          <div className="flex items-center gap-4 ml-auto">
            {/* 모드 선택 및 Backend 모드 GitHub URL 입력 */}
            <div className="flex items-center gap-3">
              {/* Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-full p-1 text-xs">
                <button
                  type="button"
                  onClick={() => onModeChange && onModeChange('local')}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    mode === 'local'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Local
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange && onModeChange('backend')}
                  className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    mode === 'backend'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Backend
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

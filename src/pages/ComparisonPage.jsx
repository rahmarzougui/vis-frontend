import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mockFunctions } from '../mockData';

const ComparisonPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFunctionIds, setSelectedFunctionIds] = useState([]);
  const [comparedFunctions, setComparedFunctions] = useState([]);

  useEffect(() => {
    // Get function IDs from URL params or localStorage
    const idsFromParams = searchParams.get('ids');
    if (idsFromParams) {
      const ids = idsFromParams.split(',').map(id => parseInt(id));
      setSelectedFunctionIds(ids);
      loadComparedFunctions(ids);
    }
  }, [searchParams]);

  const loadComparedFunctions = (ids) => {
    const functions = ids.map(id => mockFunctions.find(f => f.id === id)).filter(Boolean);
    setComparedFunctions(functions);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (comparedFunctions.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No functions selected for comparison</h2>
          <button
            onClick={() => navigate('/warnings')}
            className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            Back to Warnings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Function Comparison</h1>
            <p className="text-gray-600">Comparing {comparedFunctions.length} functions</p>
          </div>
          <button
            onClick={() => navigate('/warnings')}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium"
          >
            Back to Warnings
          </button>
        </div>

        {/* Comparison Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Metric
                  </th>
                  {comparedFunctions.map((func, index) => (
                    <th key={func.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {func.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Complexity
                  </td>
                  {comparedFunctions.map((func) => (
                    <td key={func.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        func.complexity > 15 ? 'bg-red-100 text-red-800' :
                        func.complexity > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {func.complexity}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Call Count
                  </td>
                  {comparedFunctions.map((func) => (
                    <td key={func.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {func.callCount}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Warnings
                  </td>
                  {comparedFunctions.map((func) => (
                    <td key={func.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {func.warnings.length}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Quality Score
                  </td>
                  {comparedFunctions.map((func) => (
                    <td key={func.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Math.max(0, 100 - func.complexity * 5 - func.warnings.length * 10)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    High Severity Warnings
                  </td>
                  {comparedFunctions.map((func) => (
                    <td key={func.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {func.warnings.filter((w) => w.severity === 'High').length}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Actions
                  </td>
                  {comparedFunctions.map((func) => (
                    <td key={func.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {/* 상세 페이지 이동 기능 제거 */}
                      —
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Warning Details */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Warning Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparedFunctions.map((func) => (
              <div key={func.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">{func.name}</h3>
                <div className="space-y-2">
                  {func.warnings.map((warning) => (
                    <div key={warning.id} className={`border-l-4 ${getSeverityColor(warning.severity)} pl-3 py-1`}>
                      <div className="text-sm font-medium">{warning.type}</div>
                      <div className="text-xs text-gray-600">{warning.tool}</div>
                    </div>
                  ))}
                  {func.warnings.length === 0 && (
                    <div className="text-green-600 text-sm">No warnings</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonPage;

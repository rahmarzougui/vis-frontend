import { useParams, useNavigate } from 'react-router-dom';
import { mockFunctions } from '../mockData';

const CallGraphPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const functionId = parseInt(id || '1');
  const func = mockFunctions.find(f => f.id === functionId);

  if (!func) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-73px)]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Function not found</h2>
          <button
            onClick={() => navigate('/warnings')}
            className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Back to Warnings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Function Detail Graph</h1>
            <p className="text-sm text-gray-600">Exploring call relationships for: <strong>{func.name}</strong></p>
          </div>
          <button
            onClick={() => navigate('/warnings')}
            className="bg-primary hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Back to Warnings
          </button>
        </div>
      </div>

      {/* Main Area - Placeholder for future call graph */}
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="max-w-xl mx-auto text-center px-6 py-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Call graph visualization will be added here.
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            This page is reserved for a new call graph view for <strong>{func.name}</strong>.
          </p>
          <p className="text-xs text-gray-500">
            Once the new call graph is ready, it will replace this placeholder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CallGraphPage;

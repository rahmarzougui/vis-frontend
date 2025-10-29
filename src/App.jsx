import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import WarningsPage from './pages/WarningsPage';
import FunctionDetailPage from './pages/FunctionDetailPage';
import CallGraphPage from './pages/CallGraphPage';
import ComparisonPage from './pages/ComparisonPage';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar */}
        <Navbar />
        
        {/* Main Content Area */}
        <Routes>
          <Route path="/" element={<Navigate to="/warnings" replace />} />
          <Route path="/warnings" element={<WarningsPage />} />
          <Route path="/function/:id" element={<FunctionDetailPage />} />
          <Route path="/graph/:id" element={<CallGraphPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

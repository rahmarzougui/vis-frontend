import Navbar from './Navbar';
import LeftPanel from './LeftPanel';
import GraphPlaceholder from './GraphPlaceholder';
import RightPanel from './RightPanel';

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <Navbar />
      
      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel - Filters */}
        <LeftPanel />
        
        {/* Center Panel - Graph Visualization */}
        <div className="flex-1 flex flex-col">
          <GraphPlaceholder />
        </div>
        
        {/* Right Panel - Warning Details */}
        <RightPanel />
      </div>
    </div>
  );
};

export default AppLayout;

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center">
          {/* Title */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              RefaVis
            </h1>
            <span className="ml-2 text-sm text-gray-500 font-medium">
              Refactoring-Aware Visual Analytics
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

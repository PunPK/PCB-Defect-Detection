import FactoryBar from "./components/factoryBar.js";
import { Outlet } from "react-router-dom";
import { FactoryThemeProvider } from "./factoryPage/theme.js";

const LayoutWithNavFactory = () => {
  return (
    <FactoryThemeProvider>
      <div className="min-h-screen flex flex-col">
        <FactoryBar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </FactoryThemeProvider>
  );
};

export default LayoutWithNavFactory;

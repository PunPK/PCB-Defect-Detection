import FactoryBar from "./components/factoryBar.js"
import { Outlet } from "react-router-dom";
import { FactoryThemeProvider } from "./factoryPage/theme.js";

const LayoutWithNavFactory = () => {
    return (
        <FactoryThemeProvider>
            <FactoryBar />
            <Outlet />
        </FactoryThemeProvider>
    );
};

export default LayoutWithNavFactory;

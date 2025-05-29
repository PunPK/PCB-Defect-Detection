import FactoryBar from "./components/factoryBar.js"
import { Outlet } from "react-router-dom";

const LayoutWithNavFactory = () => {
    return (
        <>
            <FactoryBar />
            <Outlet />
        </>
    );
};

export default LayoutWithNavFactory;

import NavBar from "./components/NavBar.js"
import { Outlet } from "react-router-dom";

const LayoutWithNav = () => {
    return (
        <>
            <NavBar />
            <Outlet />
        </>
    );
};

export default LayoutWithNav;

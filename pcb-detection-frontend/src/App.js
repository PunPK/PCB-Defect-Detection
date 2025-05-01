import {
  Link,
  Navigate,
  BrowserRouter as Router,
  Route,
  Routes,
} from "react-router-dom";
import React, { useState } from "react";
import Home from "./page/homePage.js";
import NavBar from "./components/NavBar.js";
import HomeTest from "./page/homeTest.js";
import TestOpenCam from "./page/testOpenCam.js";

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test" element={<HomeTest />} />
        <Route path="/testcam" element={<TestOpenCam />} />
      </Routes>
    </Router>
  );
}

export default App;
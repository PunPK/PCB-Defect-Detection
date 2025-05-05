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
import UploadPage from "./page/uploadPage.js";
import TestOpenCam from "./page/testOpenCam.js";
import PCBLiveDetection from "./page/testPCBdetector.js";

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test" element={<UploadPage />} />
        <Route path="/testcam" element={<TestOpenCam />} />
        <Route path="/testDetection" element={<PCBLiveDetection />} />
      </Routes>
    </Router>
  );
}

export default App;
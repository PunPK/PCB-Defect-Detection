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
import CamDetectPCB from "./page/CamdetectPCB.js";
import TestOpenCam from "./page/testOpenCam.js";
import PCBLiveDetection from "./page/testPCBdetector.js";
import PCBVerificationPage from "./page/uploadPCBChecked.js";
import FileDetectPCB from "./page/FiledetectPCB.js";

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/camDetectPCB" element={<CamDetectPCB />} />
        <Route path="/fileDetectPCB" element={<FileDetectPCB />} />
        <Route path="/testcam" element={<TestOpenCam />} />
        <Route path="/testDetection" element={<PCBVerificationPage />} />
      </Routes>
    </Router>
  );
}

export default App;
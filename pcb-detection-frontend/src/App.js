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
import PCBVerificationPage from "./page/uploadPCBChecked.js";
import FileDetectPCB from "./page/FiledetectPCB.js";
import AboutUs from "./page/aboutUsPage.js";
import TestCam from "./page/TestCam.js";

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/camDetectPCB" element={<CamDetectPCB />} />
        <Route path="/fileDetectPCB" element={<FileDetectPCB />} />
        <Route path="/testcam" element={<TestCam />} />
        <Route path="/PCBVerification" element={<PCBVerificationPage />} />
        <Route path="/AboutUs" element={<AboutUs />} />
      </Routes>
    </Router>
  );
}

export default App;
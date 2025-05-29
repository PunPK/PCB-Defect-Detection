import {
  Link,
  Navigate,
  BrowserRouter as Router,
  Route,
  Routes,
} from "react-router-dom";
import React, { useState } from "react";
import Home from "./page/homePage.js";
import CamDetectPCB from "./page/CamdetectPCB.js";
import PCBVerificationPage from "./page/uploadPCBChecked.js";
import FileDetectPCB from "./page/FiledetectPCB.js";
import AboutUs from "./page/aboutUsPage.js";
import TestCam from "./page/TestCam.js";
import Steps1 from "./analysisPage/Steps1.js"
import Steps2 from "./analysisPage/Steps2.js"
import Steps3 from "./analysisPage/Steps3.js"
import LayoutWithNav from "./LayoutWithNav.js";
import FactoryWorkflow from "./page/factoryWorkflow.js";

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      <Router>
        <Routes>
          {/* with NavBar */}
          <Route element={<LayoutWithNav />}>
            <Route path="/" element={<Home />} />
            <Route path="/camDetectPCB" element={<CamDetectPCB />} />
            <Route path="/fileDetectPCB" element={<FileDetectPCB />} />
            <Route path="/testcam" element={<TestCam />} />
            <Route path="/PCBVerification" element={<PCBVerificationPage />} />
            <Route path="/AboutUs" element={<AboutUs />} />
            <Route path="/factoryWorkflow" element={<FactoryWorkflow />} />
          </Route>

          {/* without NavBar */}
          <Route path="/Steps1" element={<Steps1 />} />
          <Route path="/Steps2" element={<Steps2 />} />
          <Route path="/Steps3" element={<Steps3 />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
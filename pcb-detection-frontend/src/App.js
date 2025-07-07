import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./page/homePage.js";
import CamDetectPCB from "./page/CamdetectPCB.js";
import PCBVerificationPage from "./page/uploadPCBChecked.js";
import FileDetectPCB from "./page/FiledetectPCB.js";
import AboutUs from "./page/aboutUsPage.js";
import TestCam from "./page/TestCam.js";
import Steps1 from "./analysisPage/Steps1.js";
// import Steps2 from "./analysisPage/Steps2.js"
// import Steps3 from "./analysisPage/Steps3.js"
import LayoutWithNav from "./LayoutWithNav.js";
import HomeFactoryWorkflow from "./factoryPage/factoryWorkflow.js";
import LayoutWithNavFactory from "./LayoutWithNav copy.js";
import ProcessFactoryWorkflow from "./factoryPage/processFactory.js";
// import ImageUploader from "./factoryPage/test_upload.js";
import PCBCameraView from "./factoryPage/test_process.js";
import DetailResult from "./factoryPage/detailResult.js";
import ResultPage from "./factoryPage/resultPage.js";
// import ShowResultPage from "./factoryPage/showResultPage.js";

function App() {
  return (
    <>
      <Router>
        <Routes>
          {/* with NavBar */}
          <Route element={<LayoutWithNav />}>
            <Route path="/" element={<Home />} />
            <Route path="/PCBVerification" element={<PCBVerificationPage />} />
            <Route path="/AboutUs" element={<AboutUs />} />
          </Route>

          <Route element={<LayoutWithNavFactory />}>
            <Route path="/home-factory" element={<HomeFactoryWorkflow />} />
            <Route path="/testcam" element={<TestCam />} />
            <Route path="/camDetectPCB" element={<CamDetectPCB />} />
            <Route path="/fileDetectPCB" element={<FileDetectPCB />} />
            <Route path="/results" element={<ResultPage />} />
            {/* <Route path="/results/:pcb_id" element={<ShowResultPage />} /> */}
            <Route
              path="/factoryWorkflow/:pcb_id"
              element={<ProcessFactoryWorkflow />}
            />
            <Route path="/details/:result_id" element={<DetailResult />} />
          </Route>

          {/* without NavBar */}
          <Route path="/Steps1" element={<Steps1 />} />
          {/* <Route path="/Steps2" element={<Steps2 />} />
          <Route path="/Steps3" element={<Steps3 />} /> */}
          <Route path="/test_upload" element={<PCBCameraView />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;

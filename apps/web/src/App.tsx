import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import Register from "./pages/register";
import Testcases from "./pages/Testcases";
import Dashboard from "./pages/Dashboard"
import CreateBug from "./pages/CreateBug"
import VerifyEmail from "./pages/VerifyEmail";
import TesterDashboard from "./pages/TesterDashboard";
import DeveloperDashboard from "./pages/DeveloperDashboard";


<Route path="/testcases" element={<Testcases />} />

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/testcases" element={<Testcases />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bugs/create" element={<CreateBug />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/tester-dashboard" element={<TesterDashboard />} />
        <Route path="/developer-dashboard" element={<DeveloperDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Routes, Route } from "react-router-dom";
import SetupPage from "./pages/SetupPage";
import GeneratePage from "./pages/GeneratePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SetupPage />} />
        <Route path="/generate" element={<GeneratePage />} />
      </Routes>
    </BrowserRouter>
  );
}
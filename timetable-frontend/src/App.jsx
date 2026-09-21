import { BrowserRouter, Routes, Route } from "react-router-dom";

import SetupPage from "./pages/SetupPage";
import TeachersPage from "./pages/TeachersPage";
import SectionsPage from "./pages/SectionsPage";
import SubjectsPage from "./pages/SubjectsPage";
import GeneratePage from "./pages/GeneratePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SetupPage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/sections" element={<SectionsPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/generate" element={<GeneratePage />} />
      </Routes>
    </BrowserRouter>
  );
}

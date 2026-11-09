import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Tasks from "./pages/Tasks";
import StudyPlan from "./pages/StudyPlan";
import Subjects from "./pages/Subjects";
import Timetable from "./pages/Timetable";
import Pomodoro from "./pages/Pomodoro";
import Notes from "./pages/Notes";
import Settings from "./pages/Settings";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Tasks />} />
              <Route path="/plan" element={<StudyPlan />} />
              <Route path="/subjects" element={<Subjects />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/pomodoro" element={<Pomodoro />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

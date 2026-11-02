import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Subjects from './pages/Subjects'
import Tasks from './pages/Tasks'
import Timetable from './pages/Timetable'
import Pomodoro from './pages/Pomodoro'
import Notes from './pages/Notes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/" element={<Tasks />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/pomodoro" element={<Pomodoro />} />
          <Route path="/notes" element={<Notes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
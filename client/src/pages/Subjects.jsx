import { useState } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'

const COLORS = ['#4F46E5', '#14B8A6', '#F59E0B', '#EF4444', '#EC4899', '#22C55E', '#0EA5E9', '#8B5CF6']

function Subjects() {
  const [subjects, setSubjects] = useLocalStorage('studymate-subjects', [])
  const [name, setName] = useState('')
  const [type, setType] = useState('theory')

  function addSubject(e) {
    e.preventDefault()
    if (!name.trim()) return
    const color = COLORS[subjects.length % COLORS.length]
    setSubjects([...subjects, { id: Date.now(), name: name.trim(), type, color }])
    setName('')
  }

  function deleteSubject(id) {
    setSubjects(subjects.filter((s) => s.id !== id))
  }

  const theoryCount = subjects.filter((s) => s.type === 'theory').length
  const practicalCount = subjects.length - theoryCount

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold">Subjects</h2>
      <p className="mb-4 text-sm text-slate-500">
        {subjects.length} subjects: {theoryCount} theory, {practicalCount} practical
      </p>

      <form onSubmit={addSubject} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subject name (e.g. Physics)"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          <option value="theory">Theory</option>
          <option value="practical">Practical</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add
        </button>
      </form>

      {subjects.length === 0 ? (
        <p className="text-sm text-slate-500">No subjects yet. Add the ones from your timetable.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {subjects.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                {s.type}
              </span>
              <button
                onClick={() => deleteSubject(s.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Subjects
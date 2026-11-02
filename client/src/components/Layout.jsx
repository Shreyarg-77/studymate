import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Tasks', end: true },
  { to: '/timetable', label: 'Timetable' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/notes', label: 'Notes' },
]

function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="hidden md:flex md:w-56 md:min-h-screen md:flex-col md:border-r md:border-slate-200 md:bg-white md:p-4">
        <h1 className="mb-6 text-xl font-bold text-indigo-600">StudyMate</h1>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 pb-24 md:p-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white md:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs font-medium ${
                isActive ? 'text-indigo-600' : 'text-slate-500'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default Layout
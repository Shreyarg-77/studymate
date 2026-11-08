import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Tasks", end: true },
  { to: "/subjects", label: "Subjects" },
  { to: "/timetable", label: "Timetable" },
  { to: "/pomodoro", label: "Pomodoro" },
  { to: "/notes", label: "Notes" },
];

function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="hidden md:flex md:min-h-screen md:w-56 md:flex-col md:border-r md:border-slate-200 md:bg-white md:p-4">
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
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="mb-2 truncate text-xs text-slate-500">{user?.email}</p>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Log out
          </button>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-bold text-indigo-600">StudyMate</span>
        <button onClick={logout} className="text-sm text-red-500">
          Log out
        </button>
      </header>

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
                isActive ? "text-indigo-600" : "text-slate-500"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Layout;

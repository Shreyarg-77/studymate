import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Reminders from "./Reminders";

const mainLinks = [
  { to: "/", label: "Tasks", end: true },
  { to: "/plan", label: "Plan" },
  { to: "/timetable", label: "Timetable" },
  { to: "/pomodoro", label: "Pomodoro" },
  { to: "/notes", label: "Notes" },
];

const moreLinks = [
  { to: "/report", label: "Report" },
  { to: "/subjects", label: "Subjects" },
  { to: "/settings", label: "Settings" },
];

const sideLinks = [
  { to: "/", label: "Tasks", end: true },
  { to: "/plan", label: "Plan" },
  { to: "/report", label: "Report" },
  { to: "/timetable", label: "Timetable" },
  { to: "/pomodoro", label: "Pomodoro" },
  { to: "/notes", label: "Notes" },
  { to: "/subjects", label: "Subjects" },
  { to: "/settings", label: "Settings" },
];

function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="hidden md:flex md:min-h-screen md:w-56 md:flex-col md:border-r md:border-slate-200 md:bg-white md:p-4">
        <h1 className="mb-6 text-xl font-bold text-indigo-600">StudyMate</h1>
        <nav className="flex flex-col gap-1">
          {sideLinks.map((link) => (
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

      <header className="relative flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-bold text-indigo-600">StudyMate</span>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>

        {menuOpen && (
          <div className="absolute right-3 top-12 z-20 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <p className="truncate px-2 py-1 text-xs text-slate-500">
              {user?.email}
            </p>
            {moreLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-2 py-2 text-sm ${
                    isActive
                      ? "bg-indigo-50 font-medium text-indigo-600"
                      : "text-slate-700"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <button
              onClick={logout}
              className="mt-1 block w-full rounded-md px-2 py-2 text-left text-sm text-red-500"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="min-w-0 flex-1 p-4 pb-28 md:p-8">
        <Reminders />
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {mainLinks.map((link) => (
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

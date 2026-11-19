import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Reminders from "./Reminders";

const links = [
  { to: "/", label: "Tasks", icon: "✅", end: true },
  { to: "/plan", label: "Plan", icon: "📅" },
  { to: "/report", label: "Report", icon: "📊" },
  { to: "/timetable", label: "Timetable", icon: "🏫" },
  { to: "/pomodoro", label: "Pomodoro", icon: "⏱️" },
  { to: "/notes", label: "Notes", icon: "📝" },
  { to: "/subjects", label: "Subjects", icon: "📚" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

const BOTTOM = ["/", "/plan", "/timetable", "/pomodoro", "/notes"];
const bottomLinks = BOTTOM.map((to) => links.find((l) => l.to === to));
const moreLinks = links.filter((l) => !BOTTOM.includes(l.to));

function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-slate-200 md:bg-white md:p-4">
        <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-indigo-600">
          <span aria-hidden="true">📚</span> StudyMate
        </h1>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <span aria-hidden="true" className="w-5 text-center">
                {link.icon}
              </span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 border-t border-slate-200 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <button
              onClick={logout}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <header className="relative flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-bold text-indigo-600">📚 StudyMate</span>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600"
        >
          {menuOpen ? "Close" : "Menu"}
        </button>

        {menuOpen && (
          <div className="absolute right-3 top-12 z-20 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <p className="truncate px-2 py-1 text-xs text-slate-500">
              {user?.email}
            </p>
            {moreLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                    isActive
                      ? "bg-indigo-50 font-medium text-indigo-600"
                      : "text-slate-700"
                  }`
                }
              >
                <span aria-hidden="true">{link.icon}</span>
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

      <main className="min-w-0 flex-1 p-4 pb-28 md:p-8 lg:px-10">
        <Reminders />
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {bottomLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? "text-indigo-600" : "text-slate-500"
              }`
            }
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {link.icon}
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Layout;

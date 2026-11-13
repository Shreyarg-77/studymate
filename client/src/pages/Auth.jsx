import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import useSlowFlag from "../hooks/useSlowFlag";

function AuthForm({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const justRegistered = !isRegister && location.state?.registered === true;

  const [name, setName] = useState("");
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const slow = useSlowFlag(submitting);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(name, email, password);
        navigate("/login", {
          replace: true,
          state: { registered: true, email: email.trim().toLowerCase() },
        });
      } else {
        await login(email, password);
        navigate(location.state?.from?.pathname || "/", { replace: true });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="mb-1 text-2xl font-bold text-indigo-600">StudyMate</h1>
        <p className="mb-5 text-sm text-slate-500">
          {isRegister ? "Create your account" : "Log in to your planner"}
        </p>

        {justRegistered && (
          <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            Account created. Please log in with your new details.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isRegister && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={60}
              className={inputClass}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            maxLength={254}
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isRegister ? "Password (6 to 72 characters)" : "Password"
            }
            autoComplete={isRegister ? "new-password" : "current-password"}
            autoFocus={justRegistered}
            maxLength={72}
            className={inputClass}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Log in"}
          </button>

          {slow && (
            <p className="text-xs text-slate-500">
              The server is waking up after being idle. This can take up to a
              minute. Please keep this page open.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          {isRegister ? "Already have an account? " : "New here? "}
          <Link
            to={isRegister ? "/login" : "/register"}
            className="font-medium text-indigo-600 hover:underline"
          >
            {isRegister ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Auth({ mode }) {
  return <AuthForm key={mode} mode={mode} />;
}

export default Auth;

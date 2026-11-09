import { useState, useEffect } from "react";
import api, { errorMessage } from "../api/client";

const MIN_OPTIONS = [15, 20, 30, 45, 60];
const MAX_OPTIONS = [30, 45, 60, 90, 120, 180];
const BREAK_OPTIONS = [0, 5, 10, 15, 20, 30];
const QUICK = [
  { label: "Lunch", start: "13:00", end: "14:00" },
  { label: "Dinner", start: "20:00", end: "21:00" },
  { label: "Evening walk", start: "18:00", end: "18:30" },
];
const DEFAULTS = {
  dayStart: "08:00",
  dayEnd: "22:00",
  minSlotMins: 30,
  maxSlotMins: 90,
  breakMins: 10,
  blockedTimes: [],
};

let counter = 0;
const newKey = () => `new-${Date.now()}-${counter++}`;
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function withKeys(settings) {
  return {
    ...settings,
    blockedTimes: settings.blockedTimes.map((b) => ({ ...b, key: b._id })),
  };
}

function checkForm(form) {
  if (!form.dayStart || !form.dayEnd) return "Enter your study hours.";
  if (toMin(form.dayEnd) - toMin(form.dayStart) < 60) {
    return "Your study day must be at least 1 hour long.";
  }
  if (form.maxSlotMins < form.minSlotMins) {
    return "The longest slot cannot be shorter than the shortest slot.";
  }
  if (form.blockedTimes.length > 10)
    return "You can add up to 10 blocked times.";
  for (const b of form.blockedTimes) {
    if (!b.label.trim()) return "Give every blocked time a name.";
    if (!b.start || !b.end || toMin(b.end) <= toMin(b.start)) {
      return `${b.label.trim()}: the end time must be after the start time.`;
    }
  }
  return "";
}

function Settings() {
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/settings")
      .then((res) => {
        if (!cancelled) setForm(withKeys(res.data));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function updateBlocked(key, field, value) {
    setForm((prev) => ({
      ...prev,
      blockedTimes: prev.blockedTimes.map((b) =>
        b.key === key ? { ...b, [field]: value } : b,
      ),
    }));
    setSaved(false);
  }

  function addBlocked(preset) {
    setForm((prev) => ({
      ...prev,
      blockedTimes: [
        ...prev.blockedTimes,
        {
          key: newKey(),
          ...(preset || { label: "", start: "13:00", end: "14:00" }),
        },
      ],
    }));
    setSaved(false);
  }

  function removeBlocked(key) {
    setForm((prev) => ({
      ...prev,
      blockedTimes: prev.blockedTimes.filter((b) => b.key !== key),
    }));
    setSaved(false);
  }

  function resetToDefaults() {
    setForm({ ...DEFAULTS });
    setSaved(false);
    setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    const problem = checkForm(form);
    if (problem) {
      setError(problem);
      setSaved(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await api.put("/settings", {
        dayStart: form.dayStart,
        dayEnd: form.dayEnd,
        minSlotMins: form.minSlotMins,
        maxSlotMins: form.maxSlotMins,
        breakMins: form.breakMins,
        blockedTimes: form.blockedTimes.map(({ label, start, end }) => ({
          label: label.trim(),
          start,
          end,
        })),
      });
      setForm(withKeys(res.data));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!form) return <p className="text-sm text-slate-500">Loading...</p>;

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";
  const labelClass = "mb-1 block text-xs font-medium text-slate-500";

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-2xl font-bold">Settings</h2>
      <p className="mb-4 text-sm text-slate-500">
        These control how your study plan is generated.
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Study hours</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Start of study day</span>
              <input
                type="time"
                value={form.dayStart}
                onChange={(e) => update("dayStart", e.target.value)}
                className={`${inputClass} w-full`}
              />
            </label>
            <label>
              <span className={labelClass}>End of study day</span>
              <input
                type="time"
                value={form.dayEnd}
                onChange={(e) => update("dayEnd", e.target.value)}
                className={`${inputClass} w-full`}
              />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-700">
            Slot lengths
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className={labelClass}>Shortest slot (min)</span>
              <select
                value={form.minSlotMins}
                onChange={(e) => update("minSlotMins", Number(e.target.value))}
                className={`${inputClass} w-full`}
              >
                {MIN_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Longest slot (min)</span>
              <select
                value={form.maxSlotMins}
                onChange={(e) => update("maxSlotMins", Number(e.target.value))}
                className={`${inputClass} w-full`}
              >
                {MAX_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Break between slots (min)</span>
              <select
                value={form.breakMins}
                onChange={(e) => update("breakMins", Number(e.target.value))}
                className={`${inputClass} w-full`}
              >
                {BREAK_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Gaps shorter than the shortest slot are left free.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-bold text-slate-700">
            Blocked times
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Times every day when no study should be planned, such as meals.
          </p>

          {form.blockedTimes.length === 0 ? (
            <p className="mb-3 text-sm text-slate-400">Nothing blocked yet.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-2">
              {form.blockedTimes.map((b) => (
                <li key={b.key} className="flex flex-wrap items-center gap-2">
                  <input
                    value={b.label}
                    onChange={(e) =>
                      updateBlocked(b.key, "label", e.target.value)
                    }
                    placeholder="Name"
                    maxLength={40}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <input
                    type="time"
                    value={b.start}
                    onChange={(e) =>
                      updateBlocked(b.key, "start", e.target.value)
                    }
                    className={inputClass}
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="time"
                    value={b.end}
                    onChange={(e) =>
                      updateBlocked(b.key, "end", e.target.value)
                    }
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeBlocked(b.key)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                type="button"
                key={q.label}
                onClick={() => addBlocked(q)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                + {q.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => addBlocked(null)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              + Custom
            </button>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && (
          <p className="text-sm text-green-700">
            Saved. Click "Regenerate plan" on the Plan page to apply this to a
            day you have already planned.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Reset to defaults
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;

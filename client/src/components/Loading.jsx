import useSlowFlag from "../hooks/useSlowFlag";

function Loading({ label = "Loading..." }) {
  const slow = useSlowFlag(true);

  return (
    <div
      role="status"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      <p className="text-sm text-slate-600">{label}</p>
      {slow && (
        <p className="max-w-xs text-xs text-slate-500">
          The server is waking up after being idle. This can take up to a
          minute, and only happens the first time. Please keep this page open.
        </p>
      )}
    </div>
  );
}

export default Loading;

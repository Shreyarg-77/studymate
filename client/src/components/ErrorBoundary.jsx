import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="mb-2 text-xl font-bold text-slate-900">
            Something went wrong
          </h1>
          <p className="mb-4 text-sm text-slate-600">
            Your saved data is safe. Reload the page to continue. If it keeps
            happening, try logging out and back in.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Reload page
            </button>
            <button
              onClick={() => window.location.assign("/")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Go to Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

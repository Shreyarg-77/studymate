import axios from "axios";

export const TOKEN_KEY = "studymate-token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 90000,
});

// Changes to these areas make other pages refresh themselves.
const WATCHED = ["/slots", "/tasks", "/pomodoro", "/timetable", "/settings"];

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || "get").toLowerCase();
    const url = response.config.url || "";
    if (method !== "get" && WATCHED.some((path) => url.startsWith(path))) {
      window.dispatchEvent(new Event("studymate-data-changed"));
    }
    return response;
  },
  (error) => {
    const url = error.config?.url || "";
    const isAuthCall =
      url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("studymate-logout"));
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === "ECONNABORTED") {
    return "The server took too long to respond. Please try again.";
  }
  if (error.response?.status >= 500) {
    return "The server had a problem. Please try again in a moment.";
  }
  if (error.request && !error.response) {
    return "Cannot reach the server. Check your internet connection and try again.";
  }
  return error.message || "Something went wrong";
}

export default api;

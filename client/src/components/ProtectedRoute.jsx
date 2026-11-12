import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DataProvider } from "../context/DataContext";
import Loading from "./Loading";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Checking your session..." />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return (
    <DataProvider key={user.id}>
      <Outlet />
    </DataProvider>
  );
}

export default ProtectedRoute;

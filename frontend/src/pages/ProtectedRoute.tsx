// src/components/ProtectedRoute.tsx
import { useAuth } from "../useAuth";
import { Navigate } from "react-router-dom";
import { User } from '../types';
import { useEffect, useState } from "react";
import Spinner from "../components/Spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user } = useAuth() as unknown as { user: User | null };
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user !== null) {
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user.role.name !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
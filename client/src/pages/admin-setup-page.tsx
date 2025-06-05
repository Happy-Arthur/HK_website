import { useEffect } from "react";
import { useLocation } from "wouter";
import { AdminSetup } from "@/components/admin/admin-setup";
import { useAuth } from "@/hooks/use-auth";

export default function AdminSetupPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  return <AdminSetup />;
}
import { useEffect, useState } from "react";
import { IdentityScreen } from "./IdentityScreen";

type Props = { children: React.ReactNode };

/**
 * Gate that requires a valid Clover Identity session (JWT).
 * We store the JWT in localStorage under "clover_token" (legacy key used across the app).
 */
export function IdentityGate({ children }: Props) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("clover_token"));

  useEffect(() => {
    // Optional: Token validity check later (e.g., /api/auth/me)
  }, []);

  if (!token) {
    return (
      <IdentityScreen
        onAuthed={(t, user) => {
          // Keep legacy storage keys used throughout the app
          localStorage.setItem("clover_token", t);
          localStorage.setItem("clover_user", JSON.stringify({ ...user, username: user.displayName ?? user.username ?? `user_${user.id}` }));

          // Also keep the new key (compat)
          localStorage.setItem("ct.jwt", t);

          setToken(t);
        }}
      />
    );
  }

  return <>{children}</>;
}

import { useState } from "react";
import { IdentityScreen } from "./IdentityScreen";

type Props = { children: React.ReactNode };

/**
 * Gate that requires a valid Clover Identity session.
 * We store the resolved user in localStorage under "clover_user".
 */
export function IdentityGate({ children }: Props) {
  const [user, setUser] = useState<string | null>(() => localStorage.getItem("clover_user"));

  if (!user) {
    return (
      <IdentityScreen
        onAuthed={(nextUser) => {
          localStorage.setItem("clover_user", JSON.stringify(nextUser));
          setUser(JSON.stringify(nextUser));
        }}
      />
    );
  }

  return <>{children}</>;
}

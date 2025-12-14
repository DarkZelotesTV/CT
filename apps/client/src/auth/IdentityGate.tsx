import { useState } from "react";
import { IdentityScreen } from "./IdentityScreen";
import { loadIdentity, type IdentityFile } from "./identity";
import { FirstStartModal, FIRST_START_KEY } from "../components/modals/FirstStartModal";

type Props = { children: React.ReactNode };

type User = { id: number; username?: string | null; displayName: string | null; fingerprint: string };

/**
 * Gate that requires a valid Clover Identity session.
 * We store the resolved user in localStorage under "clover_user".
 */
export function IdentityGate({ children }: Props) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("clover_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [firstStartDone, setFirstStartDone] = useState(() => localStorage.getItem(FIRST_START_KEY) === "1");

  const handleIdentityReady = (next: IdentityFile | null) => {
    setIdentity(next);
    if (next) {
      localStorage.setItem(FIRST_START_KEY, "1");
      setFirstStartDone(true);
    } else {
      localStorage.removeItem(FIRST_START_KEY);
      setFirstStartDone(false);
    }
  };

  const handleAuthed = (nextUser: User) => {
    localStorage.setItem("clover_user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  if (!identity || !firstStartDone) {
    return <FirstStartModal onComplete={handleIdentityReady} />;
  }

  if (!user) {
    return (
      <IdentityScreen
        onAuthed={handleAuthed}
        onIdentityChanged={(next) => {
          handleIdentityReady(next);
          if (!next) setUser(null);
        }}
      />
    );
  }

  return <>{children}</>;
}

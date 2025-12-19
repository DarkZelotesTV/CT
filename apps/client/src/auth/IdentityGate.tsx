import { useState } from "react";
import { IdentityScreen } from "./IdentityScreen";
import { loadIdentity, type IdentityFile } from "./identity";
import { FirstStartModal } from "../components/modals/FirstStartModal";
import { storage } from "../shared/config/storage";

type Props = { children: React.ReactNode };

type User = { id: number; username?: string | null; displayName: string | null; fingerprint: string };

/**
 * Gate that requires a valid Clover Identity session.
 * We store the resolved user in the shared storage helper under "clover_user".
 */
export function IdentityGate({ children }: Props) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = storage.get("cloverUser");
    return stored && Object.keys(stored).length > 0 ? (stored as User) : null;
  });
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [firstStartDone, setFirstStartDone] = useState(() => storage.get("firstStartDone"));

  const handleIdentityReady = (next: IdentityFile | null) => {
    setIdentity(next);
    if (next) {
      storage.set("firstStartDone", true);
      setFirstStartDone(true);
    } else {
      storage.remove("firstStartDone");
      setFirstStartDone(false);
    }
  };

  const handleAuthed = (nextUser: User) => {
    storage.set("cloverUser", nextUser);
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

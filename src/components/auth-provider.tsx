"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { LOCAL_USER_ID, supabase } from "@/lib/supabase";

type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; mode: "cloud"; userId: string; email: string | null }
  | { status: "signed-in"; mode: "local"; userId: string; email: null };

const AuthContext = createContext<AuthState>({ status: "loading" });

function fromUser(user: User | null | undefined): AuthState {
  if (!user) return { status: "signed-out" };
  return { status: "signed-in", mode: "cloud", userId: user.id, email: user.email ?? null };
}

const LOCAL_STATE: AuthState = {
  status: "signed-in",
  mode: "local",
  userId: LOCAL_USER_ID,
  email: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(
    supabase ? { status: "loading" } : LOCAL_STATE,
  );

  useEffect(() => {
    if (!supabase) return;

    // getSession reads localStorage, so it resolves while offline too.
    supabase.auth.getSession().then(({ data }) => setState(fromUser(data.session?.user)));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(fromUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Auth state inside the signed-in area, where the guard already ran. */
export function useSignedIn() {
  const state = useAuth();
  if (state.status !== "signed-in") {
    throw new Error("useSignedIn called outside the signed-in area");
  }
  return state;
}

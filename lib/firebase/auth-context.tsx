"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

type AuthContextType = {
  user: SessionUser | null;
};

type AuthProviderProps = {
  children: ReactNode;
  initialUser: SessionUser | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
});

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user] = useState<SessionUser | null>(initialUser);

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

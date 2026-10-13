import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://whiteboard-backend-c3yc.onrender.com";

type User = {
  username: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<string>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("wb_token"));
  const [loading, setLoading] = useState(() => !!localStorage.getItem("wb_token"));

  // Verify saved token on mount
  useEffect(() => {
    if (!token) return;

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Invalid token");
      })
      .then((data) => {
        setUser({ username: data.username, email: data.email });
      })
      .catch(() => {
        localStorage.removeItem("wb_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.setItem("wb_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const signup = async (username: string, email: string, password: string): Promise<string> => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // If auto-verified (no SMTP), log them in immediately
    if (data.token) {
      localStorage.setItem("wb_token", data.token);
      setToken(data.token);
      setUser(data.user);
    }

    return data.message;
  };

  const logout = () => {
    localStorage.removeItem("wb_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

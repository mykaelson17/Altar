import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    localStorage.setItem("theme", t);
    setTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme, applyTheme]);

  return { theme, setTheme: applyTheme, toggleTheme };
}

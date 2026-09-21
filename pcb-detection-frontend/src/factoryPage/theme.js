import { createContext, useContext, useEffect, useState } from "react";
import { flushSync } from "react-dom";

const STORAGE_KEY = "factory-theme";
const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {
    // storage unavailable – fall through to system preference
  }
  if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

export function FactoryThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  // Always print in the light theme (paper-friendly), whatever the screen theme is.
  const [isPrinting, setIsPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setIsPrinting(true));
    const after = () => setIsPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const effective = isPrinting ? "light" : theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div
        className={effective === "dark" ? "dark" : ""}
        style={{ colorScheme: effective }}
      >
        <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
          {children}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export const useFactoryTheme = () => useContext(ThemeContext);

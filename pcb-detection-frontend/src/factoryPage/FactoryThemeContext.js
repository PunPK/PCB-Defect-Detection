import React, { createContext, useContext, useState, useEffect } from "react";

const FactoryThemeContext = createContext({
  theme: "dark",
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const FactoryThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("factory_theme") || "dark";
  });

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("factory_theme", theme);
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <FactoryThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
      <div className={`${theme} min-h-screen transition-colors duration-300`}>
        {children}
      </div>
    </FactoryThemeContext.Provider>
  );
};

export const useFactoryTheme = () => useContext(FactoryThemeContext);


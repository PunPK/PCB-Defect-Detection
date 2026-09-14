import React, { createContext, useContext, useState, useEffect } from "react";

const DisplayContext = createContext();

export const DisplayProvider = ({ children, initialPcbId }) => {
  // Theme: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("display_theme") || "dark";
  });

  // Brightness: 20 - 100 (%)
  const [brightness, setBrightness] = useState(() => {
    const saved = localStorage.getItem("display_brightness");
    return saved ? Number(saved) : 100;
  });

  // Active PCB ID
  const [activePcbId, setActivePcbId] = useState(() => {
    return initialPcbId || localStorage.getItem("display_pcb_id") || "1";
  });

  // Pass threshold (%)
  const [passThreshold, setPassThreshold] = useState(() => {
    const saved = localStorage.getItem("display_pass_threshold");
    return saved ? Number(saved) : 80;
  });

  // Is Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    localStorage.setItem("display_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("display_brightness", brightness);
  }, [brightness]);

  useEffect(() => {
    if (activePcbId) {
      localStorage.setItem("display_pcb_id", activePcbId);
    }
  }, [activePcbId]);

  useEffect(() => {
    localStorage.setItem("display_pass_threshold", passThreshold);
  }, [passThreshold]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request error:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <DisplayContext.Provider
      value={{
        theme,
        setTheme,
        brightness,
        setBrightness,
        activePcbId,
        setActivePcbId,
        passThreshold,
        setPassThreshold,
        isFullscreen,
        toggleFullscreen,
      }}
    >
      {children}
    </DisplayContext.Provider>
  );
};

export const useDisplay = () => useContext(DisplayContext);

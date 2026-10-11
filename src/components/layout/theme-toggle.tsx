import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem("agrilink-theme") === "dark",
  );
  useEffect(() => {
    const syncTheme = () => {
      const enabled = window.localStorage.getItem("agrilink-theme") === "dark";
      setDark(enabled);
      document.documentElement.classList.toggle("dark", enabled);
    };
    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("agrilink-theme-changed", syncTheme);
    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("agrilink-theme-changed", syncTheme);
    };
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("agrilink-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("agrilink-theme-changed"));
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={toggle}
      aria-label={dark ? "Use light mode" : "Use dark mode"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

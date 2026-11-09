import { useState } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { AppSidebar, MobileSidebar } from "./components/AppSidebar";
import { ToastProvider } from "./components/Toasts";
import { Button } from "./components/ui";
import { DebuggingPage } from "./pages/DebuggingPage";

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
    setDark(next);
  };
  return { dark, toggle };
}

export default function App() {
  const { dark, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-svh w-full">
        <AppSidebar />
        <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <img src="/g5-mark.webp" alt="" className="size-6 rounded-full md:hidden" />
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Tools</span>
              <span className="text-muted-foreground/60">/</span>
              <span className="font-medium">Debugging</span>
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </header>
          <main className="flex-1">
            <DebuggingPage />
          </main>
          <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
            Generation Debugger prototype for Galleri5 AI Studio · Designed and developed by{" "}
            <span className="font-medium text-foreground">Sai Charan Sandeveni</span>
          </footer>
        </div>
      </div>
    </ToastProvider>
  );
}

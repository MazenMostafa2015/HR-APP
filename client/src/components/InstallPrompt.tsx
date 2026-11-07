import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "sll-elms-install-prompt-dismissed";
let deferredPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<(available: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    promptListeners.forEach(listener => listener(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach(listener => listener(false));
  });
}

function isStandaloneDisplayMode() {
  const displayMode = typeof window.matchMedia === "function"
    && window.matchMedia("(display-mode: standalone)").matches;
  const appleStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(displayMode || appleStandalone);
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [location] = useLocation();
  const { language } = useLanguage();
  const [available, setAvailable] = useState(() => deferredPrompt !== null);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [installed, setInstalled] = useState(isStandaloneDisplayMode);

  useEffect(() => {
    const updateAvailability = (value: boolean) => setAvailable(value);
    const handleInstalled = () => setInstalled(true);
    promptListeners.add(updateAvailability);
    setAvailable(deferredPrompt !== null);
    window.addEventListener("appinstalled", handleInstalled);

    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)")
      : null;
    const handleDisplayModeChange = () => setInstalled(isStandaloneDisplayMode());
    media?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      promptListeners.delete(updateAvailability);
      window.removeEventListener("appinstalled", handleInstalled);
      media?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const normalizedPath = location.toLowerCase();
  const inOAuthFlow = normalizedPath === "/oauth"
    || normalizedPath.startsWith("/oauth/")
    || normalizedPath === "/api/oauth"
    || normalizedPath.startsWith("/api/oauth/");
  if (!available || dismissed || installed || inOAuthFlow || normalizedPath === "/sw.js") return null;

  const arabic = language === "ar";
  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      // The banner remains dismissible for this page view when storage is unavailable.
    }
  };

  const install = async () => {
    const promptEvent = deferredPrompt;
    if (!promptEvent) {
      setAvailable(false);
      return;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch (error) {
      console.warn("[PWA] Install prompt failed:", error);
    } finally {
      deferredPrompt = null;
      promptListeners.forEach(listener => listener(false));
    }
  };

  return <aside className="elms-install-banner" aria-live="polite" aria-label={arabic ? "تثبيت SLL-Consult ELMS" : "Install SLL-Consult ELMS"}>
    <div className="elms-install-banner__copy">
      <strong>{arabic ? "SLL-Consult ELMS" : "Install SLL-Consult ELMS for quick access"}</strong>
      {arabic && <span>ثبّت التطبيق للوصول السريع.</span>}
    </div>
    <button className="elms-install-banner__install" type="button" onClick={() => void install()}>{arabic ? "تثبيت" : "Install"}</button>
    <button className="elms-install-banner__dismiss" type="button" onClick={dismiss} aria-label={arabic ? "إخفاء رسالة التثبيت" : "Dismiss install prompt"}>×</button>
  </aside>;
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "ar";

type TranslationKey =
  | "overview" | "myRequests" | "approvalQueue" | "newRequest" | "reports" | "administration"
  | "workspace" | "secureWorkspace" | "signIn" | "signOut" | "notifications" | "menu"
  | "threeStepControl" | "everyDecisionRecorded" | "employee" | "directManager" | "generalManager"
  | "peopleOperations" | "administrator" | "leaveOperations" | "connectToServer" | "serverUrl"
  | "openElms" | "continueToSignIn" | "language";

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    overview: "Overview", myRequests: "My requests", approvalQueue: "Approval queue", newRequest: "New request", reports: "Reports", administration: "Administration",
    workspace: "Workspace", secureWorkspace: "secure workspace", signIn: "Sign in", signOut: "Sign out", notifications: "Notifications", menu: "Menu",
    threeStepControl: "Three-step control", everyDecisionRecorded: "Every decision is recorded.", employee: "Employee", directManager: "Direct Manager", generalManager: "General Manager",
    peopleOperations: "People Operations", administrator: "Administrator", leaveOperations: "leave operations", connectToServer: "Connect to your ELMS server", serverUrl: "Internal server URL",
    openElms: "Open ELMS", continueToSignIn: "Continue to company sign in", language: "Language",
  },
  ar: {
    overview: "نظرة عامة", myRequests: "طلباتي", approvalQueue: "طلبات الاعتماد", newRequest: "طلب جديد", reports: "التقارير", administration: "الإدارة",
    workspace: "مساحة العمل", secureWorkspace: "مساحة عمل آمنة", signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", notifications: "الإشعارات", menu: "القائمة",
    threeStepControl: "اعتماد من ثلاث مراحل", everyDecisionRecorded: "يتم تسجيل كل قرار.", employee: "موظف", directManager: "المدير المباشر", generalManager: "المدير العام",
    peopleOperations: "إدارة شؤون الموظفين", administrator: "مسؤول النظام", leaveOperations: "إدارة الإجازات", connectToServer: "الاتصال بخادم ELMS", serverUrl: "رابط الخادم الداخلي",
    openElms: "فتح ELMS", continueToSignIn: "المتابعة إلى تسجيل الدخول", language: "اللغة",
  },
};

const LANGUAGE_KEY = "elms-language";

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem(LANGUAGE_KEY) === "ar" ? "ar" : "en"));
  const setLanguage = (next: Language) => { setLanguageState(next); localStorage.setItem(LANGUAGE_KEY, next); };
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppShell, LoggedOutLanding } from "./components/AppShell";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trpc } from "./lib/trpc";
import Home from "./pages/Home";
import Requests from "./pages/Requests";
import NewRequest from "./pages/NewRequest";
import RequestDetail from "./pages/RequestDetail";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { LoadingState } from "./components/States";

function AuthenticatedRouter({ user }: { user: { id: number; name: string | null; email: string | null; role: string } }) {
  const [, navigate] = useLocation();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => navigate("/") });
  const dashboard = trpc.dashboard.summary.useQuery(undefined, { staleTime: 30_000 });
  const unread = dashboard.data?.notifications?.length ?? 0;
  return <AppShell user={user} unreadCount={unread} onLogout={() => logout.mutate()}><Switch><Route path="/" component={Home} /><Route path="/requests" component={Requests} /><Route path="/requests/new" component={NewRequest} /><Route path="/requests/:id" component={RequestDetail} /><Route path="/reports" component={Reports} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></AppShell>;
}

function Router() {
  const auth = trpc.auth.me.useQuery();
  if (auth.isLoading) return <LoadingState label="Opening secure workspace" />;
  if (!auth.data) return <LoggedOutLanding />;
  return <AuthenticatedRouter user={auth.data} />;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

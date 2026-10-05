import { AlertCircle, ClipboardList, Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading workspace" }: { label?: string }) { return <div className="state-card loading-state"><Loader2 className="spin" size={22} /><span>{label}</span></div>; }
export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="state-card empty-state"><span className="empty-icon"><ClipboardList size={22} /></span><strong>{title}</strong><p>{description}</p>{action}</div>; }
export function ErrorState({ message = "We couldn't load this workspace." }: { message?: string }) { return <div className="state-card error-state"><AlertCircle size={20} /><div><strong>Something needs attention</strong><p>{message}</p></div></div>; }

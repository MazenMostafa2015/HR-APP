import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, FileText, UserRound } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export type RequestCardData = { id: number; requestNumber: string; employeeName: string; departmentName: string; leaveTypeName: string; startDate: string; endDate: string; totalDays: number; status: string; currentStage: string; reason?: string };

export function RequestCard({ request, compact = false }: { request: RequestCardData; compact?: boolean }) {
  return <Link href={`/requests/${request.id}`} className={`request-card ${compact ? "compact" : ""}`}><div className="request-card-main"><div className="request-code">{request.requestNumber}</div><h3>{request.leaveTypeName}</h3><p>{request.reason ?? "Leave request"}</p><div className="request-meta"><span><CalendarDays size={14} />{request.startDate} → {request.endDate}</span><span><FileText size={14} />{request.totalDays} day{request.totalDays === 1 ? "" : "s"}</span></div></div><div className="request-card-side"><StatusBadge status={request.status} /><span className="request-owner"><UserRound size={13} />{request.employeeName}</span><ArrowUpRight size={17} className="request-link-icon" /></div></Link>;
}

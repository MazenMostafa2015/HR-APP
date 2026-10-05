import { useState } from "react";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { RequestCard } from "@/components/RequestCard";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";

const statuses = ["Pending Manager Approval", "Pending General Manager Approval", "Pending HR Approval", "Approved", "Rejected by Manager", "Rejected by General Manager", "Rejected by HR", "Cancelled"];

export default function Requests() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const requests = trpc.leaveRequests.list.useQuery({ status: status === "all" ? undefined : status as any });
  if (requests.isLoading) return <LoadingState label="Loading request list" />;
  if (requests.isError || !requests.data) return <ErrorState message={requests.error?.message} />;
  const filtered = requests.data.filter(request => `${request.requestNumber} ${request.employeeName} ${request.leaveTypeName} ${request.departmentName}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="requests-page"><section className="page-intro compact-intro"><div><p className="eyebrow">Records & queue</p><h1>{status === "all" ? "Leave requests" : status}</h1><p className="page-lead">{requests.data.length} visible record{requests.data.length === 1 ? "" : "s"}. Every handoff is recorded.</p></div><div className="intro-actions"><Button variant="outline" onClick={() => requests.refetch()}><SlidersHorizontal size={16} /> Refresh</Button></div></section><section className="filter-bar"><label className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search request, employee, type…" /></label><label className="select-field"><Filter size={15} /><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{statuses.map(item => <option key={item} value={item}>{item}</option>)}</select></label></section>{filtered.length ? <div className="request-list page-request-list">{filtered.map(request => <RequestCard key={request.id} request={request} />)}</div> : <EmptyState title="No matching requests" description="Try a different status or search term." />}</div>;
}

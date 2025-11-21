import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Search, Plus, Eye, Calendar } from "lucide-react";

const debounce = (fn: (...args: any[]) => void, ms = 300) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export default function TranscriptLookup() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Array<{
    p_id: string;
    patient_name?: string;
    patient_email?: string;
    phone_no?: string;
    visits: Array<{ id: number; visit_date?: string | null; created_at?: string | null }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [dateOpenFor, setDateOpenFor] = useState<string | null>(null);
  const [newVisitDate, setNewVisitDate] = useState<Record<string, string>>({});

  const runSearch = async (query: string) => {
    setLoading(true);
    try {
      if (query.trim().length === 0) {
        const res = await transcriptApi.listPatients();
        setPatients(res.patients || []);
      } else {
        const res = await transcriptApi.searchPatients(query.trim());
        setPatients(res.patients || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useMemo(() => debounce(runSearch, 350), []);

  useEffect(() => {
    runSearch("");
  }, []);

  useEffect(() => {
    debouncedSearch(q);
  }, [q, debouncedSearch]);

  const startNewVisit = async (p: { p_id: string; patient_name?: string; patient_email?: string; phone_no?: string; age?: number | null; bed_no?: string | null }) => {
    const picked = (newVisitDate[p.p_id] || "").trim();
    if (!picked) {
      setDateOpenFor(p.p_id);
      return;
    }
    setCreating(p.p_id);
    try {
      const res = await transcriptApi.createRecord({
        p_id: p.p_id,
        patient_name: p.patient_name || "Unknown",
        patient_email: p.patient_email,
        phone_no: p.phone_no,
        age: typeof p.age === "number" ? p.age : undefined,
        bed_no: p.bed_no || undefined,
        visit_date: picked, // yyyy-mm-dd
      });
      navigate(`/dashboard/transcript/upload/${res.record_id}`);
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Patient Lookup</h2>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full border rounded pl-9 pr-3 py-2"
                placeholder="Search by Patient ID, Name, Email, or Phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div>Loading...</div>
          ) : patients.length === 0 ? (
            <div className="text-gray-600">No patients found.</div>
          ) : (
            <div className="space-y-4">
              {patients.map((p) => (
                <div key={p.p_id} className="border rounded-xl p-4 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Patient ID: {p.p_id}</div>
                      <div className="text-sm text-gray-600">
                        {p.patient_name || "-"} {p.patient_email ? `· ${p.patient_email}` : ""} {p.phone_no ? `· ${p.phone_no}` : ""} {typeof p.age === "number" ? `· Age: ${p.age}` : ""} {p.bed_no ? `· Bed: ${p.bed_no}` : ""}
                      </div>
                    </div>
                    <button
                      disabled={!!creating}
                      onClick={() => setDateOpenFor(dateOpenFor === p.p_id ? null : p.p_id)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-[#39489D] text-white rounded hover:opacity-90 disabled:opacity-60"
                    >
                      <Plus className="w-4 h-4" />
                      {dateOpenFor === p.p_id ? "Pick Date" : "Start New Visit"}
                    </button>
                  </div>
                  {dateOpenFor === p.p_id && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="date"
                          className="pl-9 pr-3 py-2 border rounded"
                          value={newVisitDate[p.p_id] || ""}
                          onChange={(e) => setNewVisitDate((prev) => ({ ...prev, [p.p_id]: e.target.value }))}
                        />
                      </div>
                      <button
                        disabled={!!creating || !(newVisitDate[p.p_id] || "").trim()}
                        onClick={() => startNewVisit(p)}
                        className="px-3 py-2 rounded bg-[#39489D] text-white disabled:opacity-60"
                      >
                        {creating === p.p_id ? "Creating..." : "Create Visit"}
                      </button>
                      <button
                        className="px-3 py-2 rounded border"
                        onClick={() => setDateOpenFor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {p.visits?.length ? (
                    <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {p.visits.map((v) => (
                        <div key={v.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {v.visit_date ? new Date(v.visit_date).toLocaleDateString() : (v.created_at ? new Date(v.created_at).toLocaleDateString() : "—")}
                          </div>
                          <a
                            href={`/dashboard/transcript/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[#39489D] hover:opacity-80"
                            title="Open in new tab"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Eye, Calendar, Hash, User } from "lucide-react";

export const TranscriptList: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Array<{
    p_id: string;
    age?: number | null;
    visits: Array<{ id: number; visit_date?: string | null; created_at?: string | null }>;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await transcriptApi.listPatients();
        setPatients(res.patients || []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Patient Records</h2>
          <button
            className="px-4 py-2 rounded bg-[#39489D] text-white"
            onClick={() => navigate("/dashboard/transcript/new")}
          >
            New Record
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
          <div className="p-4">
          {loading ? (
            <div>Loading...</div>
          ) : patients.length === 0 ? (
            <div className="text-gray-600">No records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs md:text-sm py-3 px-3 border-b">
                      <span className="inline-flex items-center gap-2"><Hash className="w-4 h-4 text-[#39489D]" /> Patient ID</span>
                    </th>
                    <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs md:text-sm py-3 px-3 border-b">
                      <span className="inline-flex items-center gap-2"><User className="w-4 h-4 text-[#39489D]" /> Age</span>
                    </th>
                    <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs md:text-sm py-3 px-3 border-b">
                      <span className="inline-flex items-center gap-2"><Calendar className="w-4 h-4 text-[#39489D]" /> Visit</span>
                    </th>
                    <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs md:text-sm py-3 px-3 border-b">
                      View
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p, pIdx) => {
                    const visitRows = p.visits && p.visits.length ? p.visits : [];
                    if (!visitRows.length) {
                      return (
                        <tr key={`${p.p_id}-empty`} className="bg-white">
                          <td className="py-3 px-3 align-middle border-b">{p.p_id}</td>
                          <td className="py-3 px-3 align-middle border-b">{typeof p.age === "number" ? p.age : "-"}</td>
                          <td className="py-3 px-3 align-top border-b text-gray-500">No visits</td>
                          <td className="py-3 px-3 align-top border-b">—</td>
                        </tr>
                      );
                    }
                    return visitRows.map((v, idx) => (
                      <tr
                        key={`${p.p_id}-${v.id}`}
                        className={`bg-white hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer`}
                        onClick={() => navigate(`/dashboard/transcript/${v.id}`)}
                      >
                        {idx === 0 && (
                          <td className="py-3 px-3 align-middle border-b font-medium" rowSpan={visitRows.length}>
                            {p.p_id}
                          </td>
                        )}
                        {idx === 0 && (
                          <td className="py-3 px-3 align-middle border-b" rowSpan={visitRows.length}>
                            {typeof p.age === "number" ? p.age : "-"}
                          </td>
                        )}
                        <td className="py-3 px-3 border-b">
                          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs">
                            <Calendar className="w-3 h-3" />
                            {v.visit_date
                              ? new Date(v.visit_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                              : v.created_at
                              ? new Date(v.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
                              : "-"}
                          </span>
                        </td>
                        <td className="py-3 px-3 border-b">
                          <a
                            href={`/dashboard/transcript/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open in new tab"
                            className="inline-flex items-center gap-2 text-white bg-[#39489D] px-3 py-1.5 rounded-md hover:opacity-90"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs font-medium">Open</span>
                          </a>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptList;


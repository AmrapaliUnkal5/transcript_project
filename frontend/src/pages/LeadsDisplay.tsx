import React, { useEffect, useState } from "react";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";

type Lead = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
};

const LeadsDisplay = () => {
  const { selectedBot } = useBot();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const leadsPerPage = 10;

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      try {
        if (!selectedBot) return;
        const response = await authApi.getLeadsByBot(selectedBot.id);
        setLeads(response || []);
      } catch (err) {
        console.error("Error fetching leads", err);
      }
      setLoading(false);
    };

    fetchLeads();
  }, [selectedBot?.id]);

  const indexOfLast = currentPage * leadsPerPage;
  const indexOfFirst = indexOfLast - leadsPerPage;
  const currentLeads = leads.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(leads.length / leadsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (loading) return <div className="text-center py-8">Loading leads...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-semibold text-gray-800 mb-6">Leads</h2>

      {leads.length === 0 ? (
        <div className="text-gray-500">No leads found.</div>
      ) : (
        <>
          <div className="overflow-x-auto shadow-sm rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-6 py-3 text-left font-medium">Email</th>
                  <th className="px-6 py-3 text-left font-medium">Phone</th>
                  <th className="px-6 py-3 text-left font-medium">Address</th>
                  <th className="px-6 py-3 text-left font-medium">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {currentLeads.map((lead, index) => (
                  <tr
                    key={lead.id}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-gray-100"}
                  >
                    <td className="px-6 py-4">{lead.name || "—"}</td>
                    <td className="px-6 py-4">{lead.email || "—"}</td>
                    <td className="px-6 py-4">{lead.phone || "—"}</td>
                    <td className="px-6 py-4">{lead.address || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(lead.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeadsDisplay;

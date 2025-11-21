import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { ChevronDown, User, Calendar, Phone, Bed, FileText, Sparkles, Download, Share2, Edit } from "lucide-react";

// Mock component to demonstrate the improved Detail UI
export default function ImprovedTranscriptDetail() {
  const { id } = useParams();
  const recordId = Number(id);

  const [showTranscript, setShowTranscript] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});

  const [data, setData] = useState<any>({
    patient_name: "",
    age: "",
    bed_no: "",
    phone_no: "",
    visit_date: null,
    transcript_text: "",
    summary_text: "",
    dynamic_fields: {}
  });

  useEffect(() => {
    const run = async () => {
      if (!recordId) return;
      const res = await transcriptApi.getRecord(recordId);
      setData(res);
    };
    run();
  }, [recordId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Patient Info */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div
            className="p-4 text-white"
            style={{ background: "linear-gradient(to right,rgb(36, 25, 105), rgb(64, 79, 142))" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <User className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">Patient ID: {data.p_id || "-"}</h1>
                  <div className="flex flex-wrap gap-4 text-blue-100">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Age: {data.age}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      Bed: {data.bed_no}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {data.phone_no}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-colors">
                  <Share2 className="w-5 h-5 text-white" />
                </button>
                <button className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-colors">
                  <Download className="w-5 h-5 text-white" />
                </button>
                <button className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-colors">
                  <Edit className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-750 dark:to-gray-750 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Visit Date:</span>
              <span>{new Date(data.visit_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Transcript Section (first) */}
        {data.transcript_text && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Full Transcript</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Complete consultation recording</p>
                </div>
              </div>
              <ChevronDown
                className={`w-6 h-6 text-gray-500 transition-transform ${showTranscript ? "rotate-180" : ""}`}
              />
            </button>
            {showTranscript && (
              <div className="px-6 pb-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 font-mono text-sm">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {data.transcript_text}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI-Generated Summary (second) */}
        {data.summary_text && (
          <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-800 dark:to-gray-800 rounded-2xl shadow-lg border border-green-200 dark:border-green-900 overflow-hidden">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="w-full flex items-center justify-between p-6 hover:bg-white/50 dark:hover:bg-gray-750/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl shadow-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">AI-Generated Summary</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive visit overview</p>
                </div>
              </div>
              <ChevronDown
                className={`w-6 h-6 text-gray-500 transition-transform ${showSummary ? "rotate-180" : ""}`}
              />
            </button>
            {showSummary && (
              <div className="px-6 pb-6">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-inner border border-green-100 dark:border-green-900">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {data.summary_text}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Medical Information (third) - Dynamic Fields */}
        {data.dynamic_fields && Object.keys(data.dynamic_fields).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-xl">
                <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Medical Information</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Extracted clinical details</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(data.dynamic_fields)
                .sort(([a], [b]) => {
                  const order = (k: string) => (k.toLowerCase() === "diagnosis" ? 0 : k.toLowerCase() === "prescription" ? 1 : 2);
                  const oa = order(a);
                  const ob = order(b);
                  return oa === ob ? a.localeCompare(b) : oa - ob;
                })
                .map(([key, value]) => {
                const isExpanded = expandedFields[key];
                const colors = {
                  prescription: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", icon: "bg-blue-100 dark:bg-blue-900", text: "text-blue-600 dark:text-blue-400" },
                  diagnosis: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", icon: "bg-red-100 dark:bg-red-900", text: "text-red-600 dark:text-red-400" },
                  "follow-up": { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", icon: "bg-purple-100 dark:bg-purple-900", text: "text-purple-600 dark:text-purple-400" },
                  "vital signs": { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", icon: "bg-green-100 dark:bg-green-900", text: "text-green-600 dark:text-green-400" }
                };
                const colorScheme = colors[key] || { bg: "bg-gray-50 dark:bg-gray-900/20", border: "border-gray-200 dark:border-gray-700", icon: "bg-gray-100 dark:bg-gray-900", text: "text-gray-600 dark:text-gray-400" };

                return (
                  <div
                    key={key}
                    className={`${colorScheme.bg} ${colorScheme.border} border rounded-xl overflow-hidden transition-all hover:shadow-md`}
                  >
                    <button
                      onClick={() => setExpandedFields(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 ${colorScheme.icon} rounded-lg`}>
                          <FileText className={`w-5 h-5 ${colorScheme.text}`} />
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white capitalize">
                          {key.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {value}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
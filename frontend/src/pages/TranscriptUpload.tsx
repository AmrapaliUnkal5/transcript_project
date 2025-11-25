import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Loader2, ChevronDown, Upload, Mic, FileAudio, Sparkles, Plus, X, Download, Copy, Edit, Share2 } from "lucide-react";
import TranscriptQnA from "../components/TranscriptQnA";

// Mock component to demonstrate the improved UI
export default function ImprovedTranscriptUpload() {
  const { id } = useParams();
  const recordId = Number(id);

  // UI toggles
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Record<number, boolean>>({});

  // Data
  const [patientHeader, setPatientHeader] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [dynamicLabels, setDynamicLabels] = useState<string[]>(["diagnosis", "prescription"]);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [hasAudio, setHasAudio] = useState(false);

  // Loading states
  const [uploading, setUploading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Derived
  const transcriptReady = (transcript || "").trim().length > 0;

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAudios, setUploadedAudios] = useState<Array<{ name: string; url: string; source: "upload" | "record" }>>([]);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string; url: string; pending?: boolean }>>([]);
  const [pendingDoc, setPendingDoc] = useState<File | null>(null);
  const [selectedAudioPreviewUrl, setSelectedAudioPreviewUrl] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState(false);

  // Simple inline audio preview modal
  const [audioPreview, setAudioPreview] = useState<{ open: boolean; name: string; url: string }>({
    open: false,
    name: "",
    url: "",
  });

  // Setup
  useEffect(() => {
    if (!("MediaRecorder" in window)) {
      setRecordingSupported(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!recordId) return;
      const rec = await transcriptApi.getRecord(recordId);
      setPatientHeader(
        `Patient ID: ${rec.p_id}${rec.visit_date ? " · " + new Date(rec.visit_date).toLocaleDateString() : ""}`
      );
      setTranscript(rec.transcript_text || "");
      setSummary(rec.summary_text || "");
      setDynamicAnswers(rec.dynamic_fields || {});
      setHasAudio(!!rec.audio_path);
    };
    load();
  }, [recordId]);

  const mimeChoices = [
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/mp3",
  ];

  const startRecording = async () => {
    if (!recordingSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      for (const c of mimeChoices) {
        if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(c)) {
          mimeType = c;
          break;
        }
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setRecordingSupported(false);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    try {
      stopRecording();
    } catch {}
    chunksRef.current = [];
    setIsRecording(false);
  };

  const saveRecording = async () => {
    if (!recordId) return;
    // Ensure recorder is stopped and chunks are finalized
    stopRecording();
    await new Promise((r) => setTimeout(r, 250));
    const parts = chunksRef.current;
    if (!parts.length) return;
    const type = (parts[0] as any).type || "audio/webm";
    const blob = new Blob(parts, { type });
    let filename = "recording.webm";
    if (type.includes("ogg")) filename = "recording.ogg";
    else if (type.includes("m4a") || type.includes("mp4")) filename = "recording.m4a";
    else if (type.includes("wav")) filename = "recording.wav";
    else if (type.includes("mp3")) filename = "recording.mp3";

    setUploading(true);
    try {
      const res = await transcriptApi.uploadAudio(recordId, blob, filename);
      let url = (res as any)?.url || (res as any)?.audio_path || "";
      if (url) {
        url = url.replace(/\\/g, "/");
        if (!url.startsWith("http") && !url.startsWith("/")) url = "/" + url;
        setUploadedAudios((prev) => [...prev, { name: filename, url, source: "record" }]);
      }
      setHasAudio(true);
    } finally {
      setUploading(false);
      chunksRef.current = [];
    }
  };

  const handleUploadAndTranscribe = async () => {
    if (!recordId) return;
    setUploading(true);
    try {
      // 1) If a document is pending, process it now (extract text); do not auto-process at selection time
      if (pendingDoc) {
        const f = pendingDoc;
        const res = await transcriptApi.uploadDocument(recordId, f);
        setTranscript(res.transcript || "");
        setShowTranscript(true);
        // Replace the pending doc preview URL with backend URL if provided
        let serverUrl = (res as any)?.url || (res as any)?.path || "";
        if (serverUrl) {
          serverUrl = serverUrl.replace(/\\/g, "/");
          if (!serverUrl.startsWith("http") && !serverUrl.startsWith("/")) serverUrl = "/" + serverUrl;
          setUploadedDocs((prev) =>
            prev.map((d) => (d.pending && d.name === f.name ? { ...d, url: serverUrl, pending: false } : d))
          );
        } else {
          // Mark as not pending but keep local URL
          setUploadedDocs((prev) =>
            prev.map((d) => (d.pending && d.name === f.name ? { ...d, pending: false } : d))
          );
        }
        setPendingDoc(null);
        return;
      }

      // 2) Audio flow: Upload if new file/chunks are present, otherwise transcribe existing audio
      let blobToUpload: Blob | null = null;
      let filename = "recording.webm";

      if (selectedFile) {
        blobToUpload = selectedFile;
        filename = selectedFile.name;
      } else if (chunksRef.current.length) {
        const type = (chunksRef.current[0] as any).type || "audio/webm";
        blobToUpload = new Blob(chunksRef.current, { type });
        if (type.includes("ogg")) filename = "recording.ogg";
        else if (type.includes("m4a") || type.includes("mp4")) filename = "recording.m4a";
        else if (type.includes("wav")) filename = "recording.wav";
        else if (type.includes("mp3")) filename = "recording.mp3";
      }

      if (!blobToUpload) {
        if (!hasAudio) {
          alert("No audio to transcribe. Either upload a file or record audio.");
          return;
        }
      } else {
        const res = await transcriptApi.uploadAudio(recordId, blobToUpload, filename);
        let url = (res as any)?.url || (res as any)?.audio_path || "";
        if (url) {
          url = url.replace(/\\/g, "/");
          if (!url.startsWith("http") && !url.startsWith("/")) url = "/" + url;
          setUploadedAudios((prev) => [...prev, { name: filename, url, source: "upload" }]);
        }
        setHasAudio(true);
        setSelectedAudioPreviewUrl(null);
        setSelectedFile(null);
      }
      const t = await transcriptApi.transcribe(recordId);
      setTranscript(t.transcript || "");
      setShowTranscript(true);
    } finally {
      setUploading(false);
    }
  };

  const handleSummarize = async () => {
    if (!recordId) return;
    setSummarizing(true);
    try {
      const res = await transcriptApi.summarize(recordId);
      setSummary(res.summary || "");
      setShowSummary(true);
    } finally {
      setSummarizing(false);
    }
  };

  const handleGenerateFields = async () => {
    if (!recordId) return;
    setGenerating(true);
    try {
      const fields = dynamicLabels.filter(Boolean);
      const res = await transcriptApi.generateFields(recordId, fields);
      const newAnswers = (res.fields || {}) as Record<string, string>;

      // Merge answers
      setDynamicAnswers((prev) => ({ ...(prev || {}), ...newAnswers }));

      // Auto-expand any prompt that received/updated an answer
      setExpandedFields((prev) => {
        const next: Record<number, boolean> = { ...prev };
        dynamicLabels.forEach((label, idx) => {
          if (!label) return;
          if (Object.prototype.hasOwnProperty.call(newAnswers, label)) {
            next[idx] = true;
          }
        });
        return next;
      });
    } finally {
      setGenerating(false);
    }
  };

  // UI below remains the same, handlers are wired
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <TranscriptQnA recordId={isNaN(recordId) ? null : recordId} />
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div
            className="p-4 text-white"
            style={{ background: "linear-gradient(to right, rgb(36, 25, 105), rgb(64, 79, 142))" }}
          >
            <h1 className="text-xl font-semibold">Medical Transcript</h1>
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-sm">{patientHeader}</span>
            </div>
          </div>
        </div>

    {/* Small inline audio preview modal */}
    {audioPreview.open && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 w-[90%] max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate pr-4">{audioPreview.name}</div>
            <button
              onClick={() => setAudioPreview({ open: false, name: "", url: "" })}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Close
            </button>
          </div>
          <audio controls autoPlay src={audioPreview.url} className="w-full" />
        </div>
      </div>
    )}
        {/* Audio Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <FileAudio className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Audio Input</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload or record patient consultation</p>
            </div>
          </div>

          {/* Upload Area */}
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer group">
              <label className="cursor-pointer flex flex-col items-center gap-3 min-h-[160px] justify-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                  <Upload className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700 dark:text-gray-200">Upload Audio File</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">MP3, WAV, M4A, WebM</p>
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    try {
                      if (f) setSelectedAudioPreviewUrl(URL.createObjectURL(f));
                      else setSelectedAudioPreviewUrl(null);
                    } catch {
                      setSelectedAudioPreviewUrl(null);
                    }
                  }}
                />
              </label>

              {/* Upload tile: show selected audio preview and previously uploaded audios via upload */}
              {(selectedAudioPreviewUrl || uploadedAudios.some(a => a.source === "upload")) && (
                <div className="mt-3 w-full">
                  <div className="text-xs text-gray-500 mb-2">Uploaded Audio</div>
                  {selectedAudioPreviewUrl && (
                    <div className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-2 mb-2 h-10">
                      <button
                        className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                        onClick={() =>
                          setAudioPreview({
                            open: true,
                            name: selectedFile?.name || "selected-audio",
                            url: selectedAudioPreviewUrl,
                          })
                        }
                      >
                        {selectedFile?.name || "Selected audio"}
                      </button>
                      <button
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                        title="Remove"
                        onClick={() => {
                          try {
                            if (selectedAudioPreviewUrl) URL.revokeObjectURL(selectedAudioPreviewUrl);
                          } catch {}
                          setSelectedAudioPreviewUrl(null);
                          setSelectedFile(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {uploadedAudios.filter(a => a.source === "upload").length > 0 && (
                    <div className="space-y-2">
                      {uploadedAudios.filter(a => a.source === "upload").map((a, idx) => (
                        <div key={`upl-${idx}`} className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-2 h-10">
                          <button
                            className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                            onClick={() => setAudioPreview({ open: true, name: a.name, url: a.url })}
                          >
                            {a.name}
                          </button>
                          <button
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                            title="Remove"
                            onClick={() => {
                              setUploadedAudios((prev) =>
                                prev.filter((item) => !(item.name === a.name && item.url === a.url && item.source === a.source))
                              );
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-2 border-gray-300 dark:border-gray-600 rounded-xl p-4 flex flex-col items-center justify-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-full flex flex-col items-center gap-3 group min-h-[160px] justify-center"
                >
                  <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                    <Mic className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-700 dark:text-gray-200">Record Audio</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click to start recording</p>
                  </div>
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="p-3 bg-red-500 rounded-full animate-pulse">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                  </div>
                  <p className="font-medium text-red-600">Recording...</p>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelRecording}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveRecording}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Record tile: show saved recordings */}
              {uploadedAudios.filter(a => a.source === "record").length > 0 && (
                <div className="mt-1 w-full">
                  <div className="text-xs text-gray-500 mb-2">Saved Recordings</div>
                  <div className="space-y-2">
                    {uploadedAudios.filter(a => a.source === "record").map((a, idx) => (
                      <div key={`rec-${idx}`} className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-2 h-10">
                        <button
                          className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                          onClick={() => setAudioPreview({ open: true, name: a.name, url: a.url })}
                        >
                          {a.name}
                        </button>
                        <button
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                          title="Remove"
                          onClick={() => {
                            setUploadedAudios((prev) =>
                              prev.filter((item) => !(item.name === a.name && item.url === a.url && item.source === a.source))
                            );
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Document upload */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer group">
              <label className="cursor-pointer flex flex-col items-center gap-3 min-h-[160px] justify-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                  <Upload className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700 dark:text-gray-200">Upload Document</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Accepted: pdf, docx, doc, txt, csv, png, jpg, jpeg</p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.csv,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const localUrl = URL.createObjectURL(f);
                      setUploadedDocs((prev) => [...prev, { name: f.name, url: localUrl, pending: true }]);
                      setPendingDoc(f);
                    } catch {}
                  }}
                />
              </label>

              {/* Documents list inside the document tile */}
              {uploadedDocs.length > 0 && (
                <div className="mt-3 w-full">
                  <div className="text-xs text-gray-500 mb-2">Documents</div>
                  <div className="space-y-2">
                    {uploadedDocs.map((d, idx) => (
                      <div key={`doc-${idx}`} className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-2 h-10">
                        <span className="text-blue-600 dark:text-blue-400">{d.name}</span>
                        <div className="flex items-center gap-2">
                          {d.pending ? (
                            <span className="text-xs text-gray-500">Pending</span>
                          ) : (
                            <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Open</a>
                          )}
                          <button
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                            title="Remove"
                            onClick={() => {
                              setUploadedDocs((prev) => prev.filter((doc) => !(doc.name === d.name && doc.url === d.url)));
                              setPendingDoc((p) => (p && p.name === d.name ? null : p));
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Documents are shown inside their tile above */}

          {/* Transcript Section - always visible with header actions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowTranscript(!showTranscript)}>
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <FileAudio className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transcript</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={uploading}
                  onClick={handleUploadAndTranscribe}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg text-sm disabled:opacity-50"
                  title="Transcribe Audio"
                >
                  {uploading ? <span className="inline-flex items-center"><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing...</span> : 'Generate Transcript'}
                </button>
                <button
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setShowTranscript(!showTranscript)}
                  title={showTranscript ? "Collapse" : "Expand"}
                >
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showTranscript ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
            {showTranscript && (
              <div className="px-6 pb-6">
                <div className="relative bg-gray-50 dark:bg-gray-900 rounded-xl p-4 pt-10 border border-gray-200 dark:border-gray-700">
                  {/* Inline toolbar inside the transcript panel */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Download"
                      onClick={() => {
                        try {
                          const text = transcript || '';
                          if (!text) return;
                          const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "transcript.txt";
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {}
                      }}
                    >
                      <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                    <button
                      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Copy"
                      onClick={async () => {
                        try {
                          if (transcript) await navigator.clipboard.writeText(transcript);
                        } catch {}
                      }}
                    >
                      <Copy className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                    <button
                      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      title={editingTranscript ? "Stop Editing" : "Edit"}
                      onClick={() => setEditingTranscript((v) => !v)}
                    >
                      <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                    <button
                      className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Share"
                      onClick={async () => {
                        try {
                          if ((navigator as any).share && transcript) {
                            await (navigator as any).share({ text: transcript });
                          }
                        } catch {}
                      }}
                    >
                      <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>
                  {editingTranscript ? (
                    <textarea
                      className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300"
                      rows={8}
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                    />
                  ) : (
                    <textarea
                      className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300"
                      rows={8}
                      value={transcript || "No transcript yet."}
                      readOnly
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Summary Section - always visible with header action */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden mt-6">
            <div className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowSummary(!showSummary)}>
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Summary</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={summarizing || !transcriptReady}
                  onClick={handleSummarize}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={transcriptReady ? "Generate Summary" : "Transcribe first"}
                >
                  {summarizing ? <span className="inline-flex items-center"><Loader2 className="w-4 h-4 animate-spin mr-2" />Summarizing...</span> : 'Generate Summary'}
                </button>
                <button
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setShowSummary(!showSummary)}
                  title={showSummary ? "Collapse" : "Expand"}
                >
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${showSummary ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
            {showSummary && (
              <div className="px-6 pb-6">
                <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-900 dark:to-gray-900 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <textarea
                    className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300"
                    rows={6}
                    value={summary || "No summary yet."}
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Fields Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dynamic Prompts</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Extract specific information</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors" onClick={() => setDynamicLabels((prev) => [...prev, ""]) }>
                <Plus className="w-4 h-4" />
                Add  Prompts
              </button>
              {/* Invisible placeholder to align with chevron buttons in other headers */}
              <button className="p-2 rounded opacity-0 pointer-events-none">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            {dynamicLabels.map((label, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-750">
                  <input
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Field label (e.g., prescription)"
                    value={label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setDynamicLabels((prev) => {
                        const arr = [...prev];
                        const oldLabel = arr[i];
                        arr[i] = newLabel;
                        setDynamicAnswers((prevAns) => {
                          if (!prevAns) return prevAns as any;
                          if (oldLabel && oldLabel !== newLabel && (prevAns as any)[oldLabel]) {
                            const { [oldLabel]: moved, ...rest } = prevAns as any;
                            return { ...rest, [newLabel]: moved } as any;
                          }
                          return prevAns as any;
                        });
                        return arr;
                      });
                    }}
                  />
                  <button
                    onClick={() => setExpandedFields(prev => ({ ...prev, [i]: !prev[i] }))}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedFields[i] ? "rotate-180" : ""}`} />
                  </button>
                  <button className="p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 rounded-lg transition-colors" onClick={() => {
                    const removed = dynamicLabels[i];
                    setDynamicLabels((prev) => prev.filter((_, idx) => idx !== i));
                    setDynamicAnswers((prev) => {
                      const { [removed]: _drop, ...rest } = (prev || {}) as any;
                      return rest as any;
                    });
                    setExpandedFields((prev) => {
                      const { [i]: _rm, ...rest } = prev as any;
                      return rest as any;
                    });
                  }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {expandedFields[i] && (
                  <div className="p-4 bg-white dark:bg-gray-800">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Generated Answer
                    </label>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-gray-700 dark:text-gray-300">
                        {dynamicAnswers[label] || "No answer generated yet."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#39489D] hover:bg-[#323f8a] text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            onClick={handleGenerateFields}
            disabled={generating}
          >
            <Sparkles className="w-5 h-5" />
            {generating ? (
              <span className="inline-flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
              </span>
            ) : (
              "Generate Answers"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
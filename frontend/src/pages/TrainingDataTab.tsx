import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { authApi } from "../services/api";
import { ExternalLink, Trash2, X } from "lucide-react";
import { useCallback } from "react";
import ReactDOM from "react-dom";

interface TrainingDataTabProps {
  botId: number | null;
  onTrain: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

interface TrainingData {
  files: { file_name: string; id?: string; file_size?: number; wordCount?: number }[];
  scraped_content: { url: string; title: string; nodes_text_count?: number }[];
  youtube_videos: { video_title: string; video_url: string; video_id?: string; transcript_count?: number }[];
}

// Helper to extract YouTube video ID from a URL
function extractYouTubeVideoId(url: string): string | null {
  try {
    if (url.includes("youtube.com/watch")) {
      const urlParams = new URLSearchParams(new URL(url).search);
      return urlParams.get("v");
    }
    if (url.includes("youtu.be/")) {
      const pathname = new URL(url).pathname;
      return pathname.split("/")[1];
    }
    return null;
  } catch {
    return null;
  }
}

export const TrainingDataTab = ({ botId, onTrain, isLoading, onCancel }: TrainingDataTabProps) => {
  const [dataToTrain, setDataToTrain] = useState<TrainingData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalData, setModalData] = useState<TrainingData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Move loadTrainingData outside useEffect so it can be called elsewhere
  const loadTrainingData = async () => {
    if (!botId) return;
    setLoadingData(true);
    try {
      // Fetch both progress data and files with IDs
      const [progress, filesRaw] = await Promise.all([
        authApi.getBotProgressData(botId),
        authApi.getFiles(botId),
      ]);
      // Build a map of file_name to file_id
      const fileIdMap = new Map<string, string>();
      filesRaw.forEach((file: any) => {
        if (file.file_name && file.file_id) {
          fileIdMap.set(file.file_name, file.file_id.toString());
        }
      });
      // Merge file IDs into progress.files
      const mergedFiles = (progress.files || []).map((file: any) => ({
        ...file,
        id: file.id || fileIdMap.get(file.file_name) || undefined,
      }));
      setDataToTrain({
        ...progress,
        files: mergedFiles,
      });
    } catch (error) {
      console.error("Error fetching training data:", error);
      toast.error("Failed to load training content");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadTrainingData();
  }, [botId]);

  // Modal data loader
  const loadModalData = async () => {
    if (!botId) return;
    setModalLoading(true);
    try {
      // Fetch files with IDs
      const filesRaw = await authApi.getFiles(botId);
      const files = filesRaw.map((file: any) => ({
        id: file.file_id?.toString(),
        file_name: file.file_name,
        file_size: file.original_file_size_bytes || 0,
        wordCount: file.word_count || 0,
      }));
      // Fetch scraped content and YouTube videos as before
      const progress = await authApi.getBotProgressData(botId);
      setModalData({
        files,
        scraped_content: progress.scraped_content,
        youtube_videos: progress.youtube_videos,
      });
    } catch (error) {
      toast.error("Failed to load expanded data");
    } finally {
      setModalLoading(false);
    }
  };

  const hasTrainingContent = (data: TrainingData | null): boolean => {
  if (!data) return false;
  return (
    data.files.length > 0 ||
    data.scraped_content.length > 0 ||
    data.youtube_videos.length > 0
  );
};

  // Delete handlers
  const handleDeleteFile = async (fileId: string, wordCount: number = 0, fileSize: number = 0, isModal: boolean = false) => {
    if (!botId) return;
    setDeleting(fileId);
    try {
      // If wordCount or fileSize are missing, fetch them from getFiles
      let wc = wordCount;
      let fs = fileSize;
      if (!wc || !fs) {
        const filesRaw = await authApi.getFiles(botId);
        const fileObj = filesRaw.find((f: any) => f.file_id?.toString() === fileId);
        wc = wc || fileObj?.word_count || 0;
        fs = fs || fileObj?.original_file_size_bytes || 0;
      }
      await authApi.deleteFile(fileId);
      toast.success("File deleted");
      if (isModal) {
        await loadModalData();
        await loadTrainingData(); // Also refresh main table after modal delete
      } else {
        await loadTrainingData();
      }
    } catch (error) {
      toast.error("Failed to delete file");
    } finally {
      setDeleting(null);
    }
  };
  const handleDeleteScraped = async (url: string, wordCount: number = 0) => {
    if (!botId) return;
    setDeleting(url);
    try {
      await authApi.deleteScrapedUrl(botId, url, wordCount);
      toast.success("Web page deleted");
      await loadModalData();
      await loadTrainingData();
    } catch (error) {
      toast.error("Failed to delete web page");
    } finally {
      setDeleting(null);
    }
  };
  const handleDeleteYouTube = async (videoUrl: string, wordCount: number = 0) => {
    console.log("Deleting video:", videoUrl, "with wordCount:", wordCount);
    if (!botId) return;
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      toast.error("Could not extract video ID from URL");
      return;
    }
    setDeleting(videoId);
    try {
      await authApi.deleteVideo(botId, videoId, wordCount);
      toast.success("YouTube video deleted");
      await loadModalData();
      await loadTrainingData();
    } catch (error) {
      toast.error("Failed to delete YouTube video");
    } finally {
      setDeleting(null);
    }
  };

  // Modal table renderer
  const renderExpandedTable = () =>
    ReactDOM.createPortal(
      (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
          style={{ width: "100vw", height: "100vh", top: 0, left: 0 }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-5xl w-full p-8 relative"
            style={{ maxHeight: "80vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-700" onClick={() => setShowModal(false)}>
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold mb-4">Training Content Summary</h2>
            {modalLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : modalData ? (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Files */}
                    {modalData.files.map((file, index) => (
                      <tr key={`file-${index}`}> 
                        <td className="px-6 py-1 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">File</span>
                        </td>
                        <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">{file.file_name}</td>
                        <td className="px-6 py-1 whitespace-nowrap">
                          <button disabled={deleting === file.id} onClick={() => handleDeleteFile(file.id || '', file.wordCount || 0, file.file_size || 0, true)} className="text-red-500 hover:text-red-700">
                            {deleting === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Scraped content */}
                    {modalData.scraped_content.map((node, index) => (
                      <tr key={`node-${index}`}> 
                        <td className="px-6 py-1 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Web Page</span>
                        </td>
                        <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
                          <a href={node.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title={node.url}>{node.url}</a>
                        </td>
                        <td className="px-6 py-1 whitespace-nowrap">
                          <button disabled={deleting === node.url} onClick={() => handleDeleteScraped(node.url, node.nodes_text_count || 0)} className="text-red-500 hover:text-red-700">
                            {deleting === node.url ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* YouTube videos */}
                    {modalData.youtube_videos.map((video, index) => (
                      <tr key={`video-${index}`}> 
                        <td className="px-6 py-1 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-yellow-800">Video</span>
                        </td>
                        <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
                          <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title={video.video_url}>{video.video_url}</a>
                        </td>
                        <td className="px-6 py-1 whitespace-nowrap">
                          <button disabled={deleting === extractYouTubeVideoId(video.video_url) || deleting === video.video_url} onClick={() => handleDeleteYouTube(video.video_url, video.transcript_count || 0)} className="text-red-500 hover:text-red-700">
                            {deleting === extractYouTubeVideoId(video.video_url) || deleting === video.video_url ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {modalData.files.length === 0 && modalData.scraped_content.length === 0 && modalData.youtube_videos.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No training content found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">Failed to load training data</div>
            )}
          </div>
        </div>
      ),
      document.body
    );

  // Add Escape key handler for modal close
  useEffect(() => {
    if (!showModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showModal]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Training Content Summary</h3>
          <button
            className="ml-2 px-2 py-1 rounded hover:bg-blue-100 text-blue-600 flex items-center"
            onClick={async () => {
              setShowModal(true);
              await loadModalData();
            }}
            title="Expand Table"
          >
            <ExternalLink className="w-5 h-5 mr-1" /> 
          </button>
        </div>
        {loadingData ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : dataToTrain ? (
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Files */}
                {dataToTrain.files.map((file, index) => (
                  <tr key={`file-${index}`}>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">File</span>
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">{file.file_name}</td>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <button
                        disabled={deleting === file.id}
                        onClick={() => handleDeleteFile(file.id || '', file.wordCount || 0, file.file_size || 0, false)}
                        className="text-red-500 hover:text-red-700"
                      >
                        {deleting === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Scraped content */}
                {dataToTrain.scraped_content.map((node, index) => (
                  <tr key={`node-${index}`}>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Web Page</span>
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
                      <a href={node.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title={node.url}>Link</a>
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <button
                        disabled={deleting === node.url}
                        onClick={() => handleDeleteScraped(node.url, node.nodes_text_count || 0)}
                        className="text-red-500 hover:text-red-700"
                      >
                        {deleting === node.url ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {/* YouTube videos */}
                {dataToTrain.youtube_videos.map((video, index) =>
                 (
                  <tr key={`video-${index}`}>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-yellow-800">Video</span>
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap text-sm text-gray-900">
                      <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title={video.video_url}>Link</a>
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <button
                        disabled={deleting === extractYouTubeVideoId(video.video_url) || deleting === video.video_url}
                        onClick={() => handleDeleteYouTube(video.video_url, video.transcript_count || 0)}
                        className="text-red-500 hover:text-red-700"
                      >
                        {deleting === extractYouTubeVideoId(video.video_url) || deleting === video.video_url
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {dataToTrain.files.length === 0 && dataToTrain.scraped_content.length === 0 && dataToTrain.youtube_videos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No training content found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-gray-500">Failed to load training data</div>
        )}
      </div>
      {showModal && renderExpandedTable()}
      {/* Train Your Bot button at the bottom */}
      <div className="flex justify-center">
        <button
          onClick={onTrain}
          disabled={isLoading || !hasTrainingContent(dataToTrain)}
          className={`px-6 py-3 rounded-lg text-white font-medium ${isLoading || !hasTrainingContent(dataToTrain)
          ? "cursor-not-allowed bg-gray-400 text-white" : "bg-blue-600 hover:bg-blue-700"} transition-colors duration-200`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Starting Training...
            </div>
          ) : (
            "Train Your Bot"
          )}
        </button>
      </div>
      {/* Cancel button below Train button */}
      <div className="flex justify-right">
        <button
          onClick={onCancel}
          className="flex items-center px-6 py-2 rounded-lg border hover:bg-blue-50"
          style={{
            backgroundColor: "#FFFFFF",
            color: "#1D4ED8",
            borderColor: "#1D4ED8",
            borderWidth: "1px",
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "16px",
            fontWeight: 500,
            borderRadius: "12px",
            minWidth: "100px",
          }}
        >
          Previous
        </button>
      </div>
    </div>
  );
};
import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File as FileIcon, Trash2, Eye, Loader2 } from "lucide-react";
import type { FileUploadInterface } from "../types";
import { authApi } from "../services/api";
import { ApiFile } from "../types";
import { useBot } from "../context/BotContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import YouTubeUploader from "./YouTubeUploader";
import WebScrapingTab from "./WebScrapingTab";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import SubscriptionScrape from "./SubscriptionScrape";

export const FileUpload = () => {
  const { selectedBot, setSelectedBot } = useBot();
  const [existingFiles, setExistingFiles] = useState<FileUploadInterface[]>([]);
  const [newFiles, setNewFiles] = useState<FileUploadInterface[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);
  const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_WORD_COUNT = 50000; // Word count limit
  const [totalWordCount, setTotalWordCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState("files");
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const { loading, setLoading } = useLoader();
  const [currentPage, setCurrentPage] = useState(1);
  const videosPerPage = 5;
  const [existingVideosLength, setExistingVideosLength] = useState(0);
  const [remainingVideos, setRemainingVideos] = useState(5);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isVideoSelected, setIsVideoSelected] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(
    "Getting things ready for you..."
  );
  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;

  // Calculate total pages
  const totalPages = Math.ceil(youtubeVideos.length / videosPerPage);

  // Get current page videos
  const indexOfLastVideo = currentPage * videosPerPage;
  const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
  const currentVideos = youtubeVideos.slice(
    indexOfFirstVideo,
    indexOfLastVideo
  );

  // Generate page numbers
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Fetch YouTube videos for the selected bot
  const fetchYouTubeVideos = useCallback(async () => {
    console.log("selectedBot.id", selectedBot?.id);
    try {
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }

      const videos = await authApi.fetchVideosForBot(selectedBot?.id);
      if (videos.length === 0) {
        console.log("No YouTube videos found for this bot.");
      }
      console.log("videos", videos);
      setYoutubeVideos(videos);
      setExistingVideosLength(videos.length);
      setRemainingVideos(5 - videos.length);
    } catch (error) {
      console.error("Error fetching YouTube videos:", error);
      toast.error("Failed to load YouTube videos.");
    }
  }, [selectedBot]);

  useEffect(() => {
    if (activeTab === "youtube") {
      fetchYouTubeVideos();
    }
  }, [activeTab, fetchYouTubeVideos]);

  const handleFinish = async () => {
    try {
      const savedSelectedVideos = localStorage.getItem("selected_videos");
      const allvideos = localStorage.getItem("youtube_video_urls");
      const allvideosconst = allvideos ? JSON.parse(allvideos) : [];
      const parsedSelectedVideos = savedSelectedVideos
        ? JSON.parse(savedSelectedVideos)
        : [];
      console.log("parsedSelectedVideos", parsedSelectedVideos);
      console.log("allvideosconst", allvideosconst);

      if (selectedBot?.id && parsedSelectedVideos.length > 0) {
        setLoading(true);
        try {
          const responseyoutube = await authApi.storeSelectedYouTubeTranscripts(
            parsedSelectedVideos,
            selectedBot.id
          );
          console.log("responseyoutube", responseyoutube);
          console.log("Type of responseyoutube:", typeof responseyoutube);
          console.log("Keys:", Object.keys(responseyoutube || {}));
          if (responseyoutube && Object.keys(responseyoutube).length > 0) {
            const successCount = responseyoutube.stored_videos?.length || 0;
            console.log("successCount", successCount);
            const failedCount = responseyoutube.failed_videos?.length || 0;

            if (successCount > 0 && failedCount === 0) {
              toast.success(`${successCount} video(s) uploaded successfully!`);
            } else if (successCount >= 0 && failedCount >= 0) {
              toast.warning(
                `${successCount} video(s) uploaded successfully, ${failedCount} failed.`
              );
            }
          } // ✅ Remove processed videos from local storage
          console.log(
            "responseyoutube.stored_videos",
            responseyoutube.stored_videos
          );
          const storedVideos = Array.isArray(responseyoutube.stored_videos)
            ? responseyoutube.stored_videos.map((video) => video.video_url)
            : [];
          // ✅ Remove processed videos from local storage
          const remainingVideos = parsedSelectedVideos.filter(
            (video) => !responseyoutube.stored_videos.includes(video)
          );
          const toshow = allvideosconst.filter(
            (video) => !storedVideos.includes(video)
          );
          localStorage.setItem("youtube_video_urls", JSON.stringify(toshow));
          localStorage.removeItem("selected_videos");

          console.log("Remaining videos after filtering:", remainingVideos);
          console.log("storedVideos", storedVideos);

          fetchYouTubeVideos();
          // ✅ Refresh YouTubeUploader component
          setRefreshKey((prev) => prev + 1);
        } catch (error) {
          console.error("Error processing YouTube videos:", error);
          toast.error("Failed to process YouTube videos.");
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Error creating bot:", error);
      toast.error("An error occurred while uploading files.");
    }
  };

  useEffect(() => {
    if (!selectedBot) {
      const storedBot = localStorage.getItem("selectedBot");
      console.log("storedBot", storedBot);
      if (storedBot) {
        setSelectedBot(JSON.parse(storedBot));
      }
    }
  }, [selectedBot, setSelectedBot]);

  useEffect(() => {
    if (selectedBot?.id) {
      console.log("Fetching files for bot ID:", selectedBot.id);
      fetchYouTubeVideos();

      return () => {
        localStorage.removeItem("youtube_video_urls");
        localStorage.removeItem("selected_videos");
        console.log(
          "Cleared localStorage for youtube_video_urls and selected_videos"
        );
      };
    }
  }, [selectedBot?.id]);

  const handleVideoDelete = (videoUrl: string) => {
    setConfirmDelete(videoUrl); // Show confirmation popup
  };

  const confirmDeletion = async () => {
    if (!confirmDelete || !selectedBot?.id) {
      setConfirmDelete(null);
      return;
    }

    try {
      const videoId = extractVideoId(confirmDelete);
      if (!videoId) {
        console.error("Video ID is missing.");
        return;
      }
      console.log("Deleting videoId:", videoId);

      await authApi.deleteVideo(selectedBot?.id, videoId);

      setYoutubeVideos((prevVideos) =>
        prevVideos.filter((url) => url !== confirmDelete)
      );
    } catch (error) {
      console.error("Error deleting video:", error);
    } finally {
      setConfirmDelete(null);
    }
  };

  const cancelDeletion = () => {
    setConfirmDelete(null);
  };

  // Function to extract video ID from URL
  const extractVideoId = (videoUrl: string) => {
    const urlParams = new URLSearchParams(new URL(videoUrl).search);
    return urlParams.get("v");
  };

  // Fetch files when the component mounts or when selectedBot changes
  const fetchFiles = async () => {
    if (!selectedBot?.id) {
      console.error("Bot ID is missing.");
      return;
    }
    try {
      const fetchedFiles: ApiFile[] = await authApi.getFiles(selectedBot.id);
      const formattedFiles = fetchedFiles.map((file) => {
        const fileSizeBytes = parseFileSizeToBytes(file.file_size);
        return {
          id: file.file_id.toString(),
          name: file.file_name,
          type: file.file_type,
          size: fileSizeBytes,
          displaySize: file.file_size,
          uploadDate: new Date(file.upload_date),
          url: file.file_path,
          wordCount: file.word_count,
          charCount: file.character_count,
        };
      });

      const existingFilesSize = formattedFiles.reduce(
        (acc, file) => acc + file.size,
        0
      );
      const existingWordCount = formattedFiles.reduce(
        (acc, file) => acc + (file.wordCount || 0),
        0
      );
      const existingCharCount = formattedFiles.reduce(
        (acc, file) => acc + (file.charCount || 0),
        0
      );

      setTotalSize(existingFilesSize);
      setTotalWordCount(existingWordCount);
      setExistingFiles(formattedFiles);
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [selectedBot?.id]);

  const parseFileSizeToBytes = (size: string): number => {
    const sizeRegex = /^(\d+(\.\d+)?)\s*(B|KB|MB|GB)$/i;
    const match = size.match(sizeRegex);

    if (!match) {
      console.error("Invalid file size format:", size);
      return 0;
    }

    const value = parseFloat(match[1]);
    const unit = match[3].toUpperCase();

    switch (unit) {
      case "B":
        return value;
      case "KB":
        return value * 1024;
      case "MB":
        return value * 1024 * 1024;
      case "GB":
        return value * 1024 * 1024 * 1024;
      default:
        return 0;
    }
  };

  const formatBytesToHumanReadable = (bytes: number): string => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsProcessingFiles(true);

      // Check each file's size before processing (20MB limit)
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_TOTAL_SIZE
      );

      if (oversizedFiles.length > 0) {
        toast.error(
          `Files exceed the 20MB limit: ${oversizedFiles
            .map((f) => f.name)
            .join(", ")}`
        );
        setIsProcessingFiles(false);
        return;
      }

      try {
        // Process word counts for new files
        const formData = new FormData();
        acceptedFiles.forEach((file) => formData.append("files", file));
        const counts = await authApi.getWordCount(formData);

        // Calculate total size of new files
        const newFilesTotalSize = acceptedFiles.reduce(
          (acc, file) => acc + file.size,
          0
        );

        // Add new files to the state with their counts
        const addedFiles = acceptedFiles.map((file, index) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: file.type,
          size: file.size,
          displaySize: formatBytesToHumanReadable(file.size),
          uploadDate: new Date(),
          url: URL.createObjectURL(file),
          file,
          wordCount: counts[index]?.word_count || 0,
          charCount: counts[index]?.character_count || 0,
        }));

        // Update the total size and word count
        const newWordCount = addedFiles.reduce(
          (acc, file) => acc + (file.wordCount || 0),
          0
        );

        // Check if word count exceeds limit
        if (totalWordCount + newWordCount > MAX_WORD_COUNT) {
          toast.error(
            `Total word count exceed the limit ${MAX_WORD_COUNT.toLocaleString()}`
          );
          return;
        }

        setTotalSize((prev) => prev + newFilesTotalSize);
        setTotalWordCount((prev) => prev + newWordCount);
        setNewFiles((prev) => [...prev, ...addedFiles]);
        toast.success("Files added successfully");
      } catch (error) {
        console.error("Error getting word counts:", error);
        toast.error("Failed to process file word counts");
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [totalWordCount]
  );

  // Handle file deletion
  const handleDelete = async (id: string) => {
    const fileToDelete = [...existingFiles, ...newFiles].find(
      (file) => file.id === id
    );
    if (fileToDelete) {
      if (existingFiles.some((file) => file.id === id)) {
        // File is in the database: Delete via API
        try {
          await authApi.deleteFile(id);
          setExistingFiles((prev) => prev.filter((file) => file.id !== id));
          setTotalSize((prev) => prev - fileToDelete.size);
          setTotalWordCount((prev) => prev - (fileToDelete.wordCount || 0));
          toast.success("File deleted from database");
        } catch (error) {
          toast.error("Failed to delete file from database");
        }
      } else {
        // File is in user state: Remove from newFiles
        setNewFiles((prev) => prev.filter((file) => file.id !== id));
        setTotalSize((prev) => prev - fileToDelete.size);
        setTotalWordCount((prev) => prev - (fileToDelete.wordCount || 0));
        toast.success("File removed from user state");
      }
    }
  };

  // Handle save action
  const handleSave = async () => {
    if (!selectedBot) {
      toast.error("No bot selected.");
      return;
    }

    if (totalWordCount > MAX_WORD_COUNT) {
      toast.error(
        `Total word count exceeds limit of ${MAX_WORD_COUNT.toLocaleString()}`
      );
      return;
    }

    try {
      // Upload new files
      if (newFiles.length > 0) {
        const filesToUpload = newFiles
          .map((file) => file.file)
          .filter((file): file is File => file !== undefined);

        const formData = new FormData();
        filesToUpload.forEach((file) => formData.append("files", file));
        formData.append(
          "word_counts",
          JSON.stringify(newFiles.map((f) => f.wordCount))
        );
        formData.append(
          "char_counts",
          JSON.stringify(newFiles.map((f) => f.charCount))
        );
        formData.append("bot_id", selectedBot.id.toString());

        await authApi.uploadFilesWithCounts(formData);
        toast.success("Files saved successfully");

        // Fetch the updated list of files from the database
        await fetchFiles();

        // Clear the newFiles state
        setNewFiles([]);
      } else {
        toast.info("No new files to save");
      }
    } catch (error) {
      toast.error("An error occurred while saving files");
    }
  };

  // Combine existing and new files for display
  const allFiles = [...existingFiles, ...newFiles];

  // Disable save button if there are no new files
  const isSaveDisabled = newFiles.length === 0;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    //maxSize: MAX_TOTAL_SIZE,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/csv": [".csv"],
    },
  });

  const handleTabClick = (tab: string) => {
    if (tab === "websitescraping" || tab === "websiteSub") {
      // Determine the tab based on the user's subscription_plan_id
      setActiveTab(
        user.subscription_plan_id === 1 ? "websitescraping" : "websiteSub"
      );
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      {loading && <Loader />}

      {/* Tabs Section */}
      <div className="flex border-b border-gray-300 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 ${
            activeTab === "files"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500"
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab("youtube")}
          className={`px-4 py-2 ${
            activeTab === "youtube"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500"
          }`}
        >
          YouTube Videos
        </button>
        <button
          onClick={() => handleTabClick("websitescraping")}
          className={`px-4 py-2 ${
            activeTab === "websitescraping"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500"
          }`}
        >
          Web site
        </button>
      </div>

      {/* Files Tab Content */}
      {activeTab === "files" && (
        <>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            File Upload
          </h1>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors relative ${
              isDragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500"
            }`}
          >
            <input {...getInputProps()} />
            {isProcessingFiles && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <p className="text-gray-600">{processingMessage}</p>
                <p className="text-xs text-gray-500 mt-1">
                  This may take a moment...
                </p>
              </div>
            )}
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              {isDragActive
                ? "Drop the files here..."
                : "Drag & drop files here, or click to select files"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Supported files: PDF, DOC, DOCX, TXT, CSV
            </p>
          </div>

          {/* Progress Bar Section */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Document Words
              </span>
              <span
                className={`text-sm font-medium ${
                  totalWordCount > MAX_WORD_COUNT
                    ? "text-red-500"
                    : totalWordCount > MAX_WORD_COUNT * 0.8
                    ? "text-yellow-500"
                    : "text-green-500"
                }`}
              >
                {totalWordCount.toLocaleString()}/
                {MAX_WORD_COUNT.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    (totalWordCount / MAX_WORD_COUNT) * 100
                  )}%`,
                  backgroundColor:
                    totalWordCount > MAX_WORD_COUNT
                      ? "#ef4444"
                      : totalWordCount > MAX_WORD_COUNT * 0.8
                      ? "#f59e0b"
                      : "#10b981",
                }}
              ></div>
            </div>
            {totalWordCount > MAX_WORD_COUNT * 0.8 && (
              <div
                className={`mt-2 text-xs ${
                  totalWordCount > MAX_WORD_COUNT
                    ? "text-red-500 dark:text-red-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}
              >
                {totalWordCount > MAX_WORD_COUNT ? (
                  <>
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    Limit exceeded! Remove files to continue.
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    Approaching word limit (
                    {Math.round((totalWordCount / MAX_WORD_COUNT) * 100)}%)
                  </>
                )}
              </div>
            )}
          </div>

          {/* Files Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Uploaded Files
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Words
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Chars
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileIcon className="w-5 h-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900 dark:text-white">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {file.type?.split("/")[1]?.toUpperCase() || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {file.wordCount?.toLocaleString() || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {file.charCount?.toLocaleString() || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatBytesToHumanReadable(file.size)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {file.uploadDate.toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </>
      )}

      {/* YouTube Videos Tab Content */}
      {activeTab === "youtube" && (
        <div>
          <YouTubeUploader
            maxVideos={remainingVideos}
            refreshKey={refreshKey}
            setIsVideoSelected={setIsVideoSelected}
          />

          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Uploaded YouTube Videos
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Video URL
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {currentVideos.map((videoUrl, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {indexOfFirstVideo + index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {videoUrl}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleVideoDelete(videoUrl)}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="flex justify-center p-4 space-x-2">
              {pageNumbers.map((number) => (
                <button
                  key={number}
                  onClick={() => setCurrentPage(number)}
                  className={`px-4 py-2 rounded-lg ${
                    currentPage === number
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {number}
                </button>
              ))}
            </div>
          </div>
          {/* PROCESS Button */}
          <div className="p-4">
            <button
              onClick={handleFinish}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!isVideoSelected}
            >
              SAVE
            </button>
          </div>
        </div>
      )}

      {/* Website Scraping Tab Content */}
      {activeTab === "websitescraping" && user.subscription_plan_id === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white p-3">
            Website Scraping
          </h1>
          <WebScrapingTab />
        </div>
      )}

      {activeTab === "websiteSub" && user.subscription_plan_id !== 1 && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white p-3">
            Website Scraping
          </h1>
          <SubscriptionScrape />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-bold">
              Are you sure you want to delete this video?
            </h2>
            <p className="text-gray-500">{confirmDelete}</p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={confirmDeletion}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Yes, Delete
              </button>
              <button
                onClick={cancelDeletion}
                className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

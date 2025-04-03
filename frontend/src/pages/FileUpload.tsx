import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File as FileIcon, Trash2, Eye, Loader2, Lock, } from "lucide-react";
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
import { getPlanById } from "../types/index";
import {UserUsageResponse } from "../types/index";

const YouTubeUpgradeMessage = ({ requiredPlan = "Growth" }) => {
  return (
    <div className="absolute top-0 left-0 right-0 bottom--3 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-lg max-w-sm mx-4">
        <Lock className="w-10 h-10 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">
          YouTube Videos Locked
        </h3>
        <p className="text-gray-600 mb-4 text-center text-sm">
          To add YouTube videos to your knowledge base, upgrade to our <span className="font-semibold">{requiredPlan} plan.
            </span>
            This feature allows your bot to learn from video content.
        </p>
        <div className="flex justify-center">
          <a
            href="/subscription"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Upgrade Plan
          </a>
        </div>
      </div>
    </div>
  );
};

export const FileUpload = () => {
  const { selectedBot, setSelectedBot } = useBot();
  const [existingFiles, setExistingFiles] = useState<FileUploadInterface[]>([]);
  const [newFiles, setNewFiles] = useState<FileUploadInterface[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);
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
  const [userUsage, setUserUsage] = useState({
    globalWordsUsed: 0,  
    currentSessionWords: 0, 
    planLimit: 0
  });

  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  const userPlan = getPlanById(user?.subscription_plan_id);
  const MAX_FILE_SIZE = userPlan.fileSizeLimitMB * 1024 * 1024;
  const MAX_WORD_COUNT = userPlan.wordCountLimit;

  // Calculate usage metrics
  const totalWordsUsed = userUsage.globalWordsUsed + userUsage.currentSessionWords;
  console.log("userUsage.globalWordsUsed=>",userUsage.globalWordsUsed)
  console.log("userUsage.currentSessionWords=>",userUsage.currentSessionWords)
  console.log("TotalWordsUsed=>",totalWordsUsed)
  const remainingWords = Math.max(0, userUsage.planLimit - totalWordsUsed);
  const usagePercentage = Math.min(100, (totalWordsUsed / userUsage.planLimit) * 100);

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


  // Fetch user usage on component mount
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const apiUsage: UserUsageResponse = await authApi.getUserUsage();
        setUserUsage({
          globalWordsUsed: apiUsage.totalWordsUsed,
          currentSessionWords: 0,
          planLimit: apiUsage.planLimit
        });
      } catch (error) {
        console.error("Failed to fetch user usage", error);
      }
    };
    fetchUsage();
  }, []);

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

      // Calculate word count for existing files (only for this bot)
      const existingWordCount = formattedFiles.reduce(
        (acc, file) => acc + (file.wordCount || 0),
        0
      );

      setTotalSize(formattedFiles.reduce((acc, file) => acc + file.size, 0));
      setExistingFiles(formattedFiles);      
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };
      

  useEffect(() => {
    fetchFiles();
  }, [selectedBot?.id]);

  const processWordCounts = async (filesToProcess: File[]) => {
    const formData = new FormData();
    filesToProcess.forEach((file) => formData.append("files", file));
    
    try {
      const response = await authApi.getWordCount(formData);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("Error getting word counts:", error);
      toast.error("Failed to process word counts");
      throw error;
    }
  };

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
      if (remainingWords <= 0) {
        toast.error("You've reached your word limit. Please upgrade your plan.");
        return;
      }
      setIsProcessingFiles(true);

      // Check each file's size before processing
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE
      );

      if (oversizedFiles.length > 0) {
        toast.error(
          `Files exceed the ${userPlan.fileSizeLimitMB}MB limit: ${oversizedFiles
            .map((f) => f.name)
            .join(", ")}`
        );
        setIsProcessingFiles(false);
        return;
      }

      try {
        // Process word counts for new files
        const counts = await processWordCounts(acceptedFiles);
        
        let newWords = 0;
        const validFiles: FileUploadInterface[] = [];

        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i];
          const countData = counts[i];
          
          if (countData.error) {
            console.log(`File ${file.name} has error:`, countData.error);
            toast.error(`${file.name}: ${countData.error}`);
            continue;
          }

          const fileWords = countData.word_count || 0;
          
          if (totalWordsUsed + fileWords > userUsage.planLimit) {
            toast.error(`Skipped "${file.name}" - would exceed word limit`);
            continue;
          }
          
          validFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            displaySize: formatBytesToHumanReadable(file.size),
            uploadDate: new Date(),
            url: URL.createObjectURL(file),
            file,
            wordCount: fileWords,
            charCount: countData.character_count,
          });
          
          newWords += fileWords;
        }

        // Update state
        setNewFiles((prev) => [...prev, ...validFiles]);
        setTotalSize((prev) => prev + validFiles.reduce((acc, file) => acc + file.size, 0));
        setUserUsage(prev => ({
          ...prev,
          currentSessionWords: prev.currentSessionWords + newWords
        }));
        
        toast.success("Files added successfully");
      } catch (error) {
        console.error("Error processing files:", error);
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [totalWordsUsed, userUsage.planLimit, MAX_FILE_SIZE]
  );


  // Handle file deletion
  const handleDelete = async (id: string) => {
    if (!selectedBot || !selectedBot.id) {
      toast.error("No bot selected");
      return;
    }
    const fileToDelete = [...existingFiles, ...newFiles].find(
      (file) => file.id === id
    );
    if (!fileToDelete) return;

    try {
      if (existingFiles.some((file) => file.id === id)) {
        await authApi.deleteFile(id);
        setExistingFiles((prev) => prev.filter((file) => file.id !== id));
        
        // Update bot word count in backend
        await authApi.updateBotWordCount({
          bot_id: selectedBot.id,
          word_count: -fileToDelete.wordCount
        });
        
        // Update global words used
        const apiUsage: UserUsageResponse = await authApi.getUserUsage();
        setUserUsage(prev => ({
          ...prev,
          globalWordsUsed: apiUsage.totalWordsUsed
        }));
      } else {
        // File is in user state - just remove from newFiles
        setNewFiles((prev) => prev.filter((file) => file.id !== id));
        
        // Update current session words (only for files not yet saved)
        setUserUsage(prev => ({
          ...prev,
          currentSessionWords: prev.currentSessionWords - (fileToDelete.wordCount || 0)
        }));
      }
      
      // Update total size in both cases
      setTotalSize((prev) => prev - fileToDelete.size);
      
      toast.success("File deleted successfully");
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const handleSave = async () => {
    if (!selectedBot) {
      toast.error("No bot selected.");
      return;
    }

    if (totalWordsUsed > userUsage.planLimit) {
      toast.error(
        `Total word count exceeds limit of ${userUsage.planLimit.toLocaleString()}`
      );
      return;
    }

    try {
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
        
        const newWords = newFiles.reduce((acc, file) => acc + (file.wordCount || 0), 0);
        await authApi.updateBotWordCount({
          bot_id: selectedBot.id,
          word_count: newWords
        });

        const apiUsage = await authApi.getUserUsage();
        setUserUsage({
          globalWordsUsed: apiUsage.totalWordsUsed,
          currentSessionWords: 0, // Reset session words
          planLimit: apiUsage.planLimit
        });
        
        setNewFiles([]);
        await fetchFiles();
        toast.success("Files saved successfully");
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
            Maximum {userUsage.planLimit.toLocaleString()} words total, {userPlan.fileSizeLimitMB}MB per file (PDF and TXT only)
            </p>
          </div>

         {/* Progress Bar Section */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Your Word Usage
              </span>
              <span
                className={`text-sm font-medium ${
                  remainingWords <= 0
                    ? "text-red-500"
                    : remainingWords < (userUsage.planLimit * 0.2)
                    ? "text-yellow-500"
                    : "text-green-500"
                }`}
              >
                {totalWordsUsed.toLocaleString()}/
                {userUsage.planLimit.toLocaleString()}
                {userUsage.currentSessionWords > 0 && (
                  <span className="text-gray-500 ml-2">
                    (This session: {userUsage.currentSessionWords.toLocaleString()})
                  </span>
                )}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${usagePercentage}%`,
                  backgroundColor:
                    remainingWords <= 0
                      ? "#ef4444"
                      : remainingWords < (userUsage.planLimit * 0.2)
                      ? "#f59e0b"
                      : "#10b981",
                }}
              ></div>
            </div>
            {remainingWords <= 0 ? (
              <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                You've reached your word limit! Remove files or upgrade your plan.
              </div>
            ) : remainingWords < (userUsage.planLimit * 0.2) ? (
              <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                Approaching word limit ({Math.round(usagePercentage)}% used)
              </div>
            ) : null}
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
              {/* This container holds both the uploader and overlay */}
              <div className="min-h-[200px] relative rounded-md border border-dashed border-gray-300 dark:border-gray-600">
                <YouTubeUploader maxVideos={5} />
    
              {/* Show upgrade message only for plans 1 and 2 */}
                {[1, 2].includes(user.subscription_plan_id) && (
                <YouTubeUpgradeMessage requiredPlan="Growth" />
              )}
            </div>

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
import React, { useCallback, useState, useEffect, useMemo,useRef } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  File as FileIcon,
  Trash2,
  Eye,
  Loader2,
  Lock,
  Search,
  Filter,
} from "lucide-react";
import type { FileUploadInterface } from "../types";
import { authApi, BotTrainingStatus } from "../services/api";
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
import { UserUsageResponse } from "../types/index";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";
import { useNavigate } from "react-router-dom";
import { useBotStatusWebSocket } from '../services/useBotStatusWebSocket';
import { BotTrainingStatusProgress } from "./BotTrainingStatusProgress";
import { useGridRefreshWebSocket } from "../services/useGridRefreshWebSocket";
import { AlertTriangle } from "lucide-react";

const YouTubeUpgradeMessage = ({ requiredPlan = "Growth" }) => {
  return (
    <div className="absolute top-15 left-0 right-0 bottom--3 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="bg-white p-6  m-10 rounded-lg border border-gray-200 shadow-lg max-w-sm mx-4">
        <Lock className="w-10 h-10 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">
          YouTube Videos Locked
        </h3>
        <p className="text-gray-600 mb-4 text-center text-sm">
          To add YouTube videos to your knowledge base, upgrade to our{" "}
          <span className="font-semibold">{requiredPlan} plan.</span>
          This feature allows your bot to learn from video content.
        </p>
        <div className="flex justify-center">
          <a
            href="/dashboard/subscription"
            target="_blank"
            rel="noopener noreferrer"
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
  const [isReconfiguring, setIsReconfiguring] = useState(false);
  const { status: realtimeStatus, isConnected, refreshStatus } = useBotStatusWebSocket(isReconfiguring);
  const [status, setStatus] = useState<BotTrainingStatus | null>(null);
  const { selectedBot, setSelectedBot } = useBot();
  const [existingFiles, setExistingFiles] = useState<FileUploadInterface[]>([]);
  const [newFiles, setNewFiles] = useState<FileUploadInterface[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [totalWordCount, setTotalWordCount] = useState<number>(0);
  const [isRetraining, setIsRetraining] = useState(false);
  // const [activeTab, setActiveTab] = useState(user.subscription_plan_id === 1 || user.subscription_plan_id === 2
  //   ? "websitescraping"
  //   : "websiteSub");
  const [youtubeVideos, setYoutubeVideos] = useState<
    {
      video_url: string;
      video_title: string;
      video_id: string;
      transcript_count?: number;
      upload_date?: string;
      status?: string,
      error_code?:string;
    }[]
  >([]);
  // const [isConfigured, setIsConfigured] = useState(false);
  const [isConfigured, setIsConfigured] = useState(() => {
    return localStorage.getItem("isConfigured") === "true";
  });
  const { loading, setLoading } = useLoader();
  const [currentPage, setCurrentPage] = useState(1);
  const videosPerPage = 5;
  const [existingVideosLength, setExistingVideosLength] = useState(0);
  const [remainingVideos, setRemainingVideos] = useState(5);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isVideoSelected, setIsVideoSelected] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScrapeButtonVisible, setIsScrapeButtonVisible] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(
    "Getting things ready for you..."
  );
  const [isVideoProcessing, setIsVideoProcessing] = useState(false);
  const navigate = useNavigate();

  const [externalKnowledge, setExternalKnowledge] = useState<boolean>(
    selectedBot?.external_knowledge || false
  );

  const [activeTabLock, setActiveTabLock] = useState(false);
  type Video1 = {
    video_url: string;
    reason: string;
  };

  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  const { getPlanById } = useSubscriptionPlans();
  const userPlan = getPlanById(user?.subscription_plan_id);
  console.log("userPlan====>", userPlan);
  const parseStorageLimit = (limitStr: string): number => {
    const units: Record<string, number> = {
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };

    const match = limitStr.match(/^(\d+)\s*(KB|MB|GB|TB)$/i);
    if (!match) return 20 * 1024 ** 2; // Default 20MB if parsing fails

    const unit = match[2].toUpperCase();
    return parseInt(match[1]) * units[unit];
  };

  const [userUsage, setUserUsage] = useState({
    globalWordsUsed: 0,
    currentSessionWords: 0,
    planLimit: userPlan?.word_count_limit || 50000,
    globalStorageUsed: 0,
    currentSessionStorage: 0,
    storageLimit: parseStorageLimit(userPlan?.storage_limit || "20 MB"),
  });

  const MAX_FILE_SIZE = (userPlan?.per_file_size_limit ?? 20) * 1024 * 1024;
  const MAX_WORD_COUNT = userPlan?.word_count_limit;
  const lastProgressRef = useRef<any>(null); //Track last progress snapshot
  const [refetchScrapedUrls, setRefetchScrapedUrls] = useState<() => void>();
  const { gridStatus, isConnected: isGridWsConnected } = useGridRefreshWebSocket();
  const prevWebsiteStatusRef = useRef<Record<string, any> | null>(null);

  // Calculate usage metrics
  const totalWordsUsed =
    userUsage.globalWordsUsed + userUsage.currentSessionWords;
  console.log("userUsage.globalWordsUsed=>", userUsage.globalWordsUsed);
  console.log("userUsage.currentSessionWords=>", userUsage.currentSessionWords);
  console.log("TotalWordsUsed=>", totalWordsUsed);
  const remainingWords = Math.max(0, userUsage.planLimit - totalWordsUsed);
  const usagePercentage = Math.min(
    100,
    (totalWordsUsed / userUsage.planLimit) * 100
  );
  const totalStorageUsed =
    userUsage.globalStorageUsed ;
  console.log("userUsage.planLimit", userUsage.planLimit)

  console.log("totalStorageUsed=>", totalStorageUsed);
  const remainingStorage = Math.max(
    0,
    userUsage.storageLimit - totalStorageUsed
  );
  const storageUsagePercentage = Math.min(
    100,
    (totalStorageUsed / userUsage.storageLimit) * 100
  );


  const [activeTab, setActiveTab] = useState(
    user.subscription_plan_id === 1 || user.subscription_plan_id === 2
      ? "websitescraping"
      : "websiteSub"
  );

  const [showCancelWarning, setShowCancelWarning] = useState(false);

  const handleCancelClick = () => {
    setShowCancelWarning(true);
  };

  const handleCancelConfirm = async () => {
    setShowCancelWarning(false);
    await handleCancel(); 
  };

  const handleCancelClose = () => {
    setShowCancelWarning(false);
  };
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [nodes, setNodes] = useState<string[]>([]);
  const [hasWebChanges, setHasWebChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fileSearchTerm, setFileSearchTerm] = useState("");
  const [fileStatusFilter, setFileStatusFilter] = useState("all");


  useEffect(() => {
    if (status?.overall_status === "reconfiguring") {
      setIsReconfiguring(true);
      setActiveTabLock(true);
    }
  }, [status?.overall_status]);

  console.log("status?.overall_status", status?.overall_status)

  // Fetch initial status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      if (selectedBot?.id) {
        try {
          const response = await authApi.getBotTrainingStatus(selectedBot.id);
          setStatus(response);
        } catch (error) {
          console.error('Error fetching bot status:', error);
        }
      }
    };
    fetchStatus();
  }, [selectedBot?.id]);

  // Update status when WebSocket message arrives
  useEffect(() => {
    if (realtimeStatus) {
      setStatus(realtimeStatus);
    }
  }, [realtimeStatus]);

  useEffect(() => {
    const fetchExternalKnowledgeStatus = async () => {
      if (selectedBot?.id) {
        try {
          const response = await authApi.getBotExternalKnowledge(
            selectedBot.id
          );
          if (response?.success) {
            setExternalKnowledge(response.external_knowledge);
            // Update the bot context if needed
            if (
              selectedBot.external_knowledge !== response.external_knowledge
            ) {
              setSelectedBot((prev: any) =>
                prev
                  ? {
                    ...prev,
                    external_knowledge: response.external_knowledge,
                  }
                  : null
              );
            }
          }
        } catch (error) {
          console.error("Error fetching external knowledge status:", error);
        }
      }
    };

    fetchExternalKnowledgeStatus();
  }, [selectedBot?.id, setSelectedBot]);

  useEffect(() => {
    if (selectedBot) {
      localStorage.setItem("selectedBot", JSON.stringify(selectedBot));
    }
  }, [selectedBot]);

  // Fetch user usage on component mount
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const apiUsage: UserUsageResponse = await authApi.getUserUsage();
        setUserUsage({
          globalWordsUsed: apiUsage.totalWordsUsed,
          currentSessionWords: 0,
          planLimit: apiUsage.planLimit,
          globalStorageUsed: apiUsage.totalStorageUsed || 0,
          currentSessionStorage: 0,
          storageLimit: parseStorageLimit(userPlan?.storage_limit || "20 MB"),
        });
      } catch (error) {
        console.error("Failed to fetch user usage", error);
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUsage(); //  Re-fetch usage when tab becomes active
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial fetch on mount
    fetchUsage();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
        // Set button state to loading instead of global loading
        setIsVideoProcessing(true);

        try {
          const responseyoutube = await authApi.storeSelectedYouTubeTranscripts(
            parsedSelectedVideos,
            selectedBot.id
          );
          console.log("responseyoutube----", responseyoutube);
          console.log("Type of responseyoutube:-----", typeof responseyoutube);
          console.log(
            "Keys:--------------",
            Object.keys(responseyoutube || {})
          );

          // Check if the response indicates processing started in the background
          if (
            responseyoutube &&
            responseyoutube.message &&
            (responseyoutube.message.includes("processing started") ||
              responseyoutube.message.includes("Video processing") ||
              responseyoutube.message.includes("background") ||
              responseyoutube.status === "processing")
          ) {
            toast.info(
              ` Your YouTube videos are being processed. Inserted ${responseyoutube.inserted}, skipped ${responseyoutube.skipped} as already existing.`
            );

            // Clear selected videos since they're being processed
            localStorage.removeItem("selected_videos");
            localStorage.removeItem("youtube_video_urls");
            setRefreshKey((prev) => prev + 1);
            window.dispatchEvent(new Event("resetYouTubeUploader"));

            if (selectedBot?.status === "In Progress") {
              await authApi.updateBotStatusActive(selectedBot.id, {
                status: "Active",
                is_active: true,
              });
            }
             fetchYouTubeVideos();
          // ✅ Refresh YouTubeUploader component
          setRefreshKey((prev) => prev + 1);

            return; // Exit early since videos are being processed in background
          } else{
            toast.info(
              `  ${responseyoutube.message}`
            );
          }

          // Handle traditional synchronous response (for backward compatibility)
          // if (responseyoutube && Object.keys(responseyoutube).length > 0) {
          //   const successCount = responseyoutube.stored_videos?.length || 0;
          //   console.log("successCount", successCount);
          //   const failedCount = responseyoutube.failed_videos?.length || 0;

          //   if (successCount > 0 && failedCount === 0) {
          //     // All successful
          //     toast.success(`${successCount} video(s) uploaded successfully!`);
          //   } else if (successCount > 0 && failedCount > 0) {
          //     // Some success, some failed
          //     const failedDetails = responseyoutube.failed_videos
          //       .map(
          //         (video: Video1, index: number) =>
          //           `${index + 1}. ${video.video_url} - ${video.reason}`
          //       )
          //       .join("\n");

          //     toast.success(`${successCount} video(s) uploaded successfully!`);
          //     toast.warning(
          //       `However, ${failedCount} video(s) failed to upload:\n\n${failedDetails}`
          //     );
          //   } else if (successCount === 0 && failedCount > 0) {
          //     // All failed
          //     const failedDetails = responseyoutube.failed_videos
          //       .map(
          //         (video: Video1, index: number) =>
          //           `${index + 1}. ${video.video_url} - ${video.reason}`
          //       )
          //       .join("\n");

          //     toast.error(
          //       `All ${failedCount} video(s) failed to upload:\n\n${failedDetails}`
          //     );
          //   }
          // }
          // ✅ Remove processed videos from local storage
          // console.log(
          //   "responseyoutube.stored_videos",
          //   responseyoutube.stored_videos
          // );
          // const storedVideos = Array.isArray(responseyoutube.stored_videos)
          //   ? responseyoutube.stored_videos.map(
          //     (video: Video1) => video.video_url
          //   )
          //   : [];
          // // ✅ Remove processed videos from local storage
          // const remainingVideos = parsedSelectedVideos.filter(
          //   (video: Video1) => !responseyoutube.stored_videos.includes(video)
          // );
          // const toshow = allvideosconst.filter(
          //   (video: Video1) => !storedVideos.includes(video)
          // );
          // localStorage.setItem("youtube_video_urls", JSON.stringify(toshow));
          // localStorage.removeItem("selected_videos");

          // console.log("Remaining videos after filtering:", remainingVideos);
          // console.log("storedVideos", storedVideos);

          fetchYouTubeVideos();
          // ✅ Refresh YouTubeUploader component
          localStorage.removeItem("selected_videos");
          localStorage.removeItem("youtube_video_urls");
          setRefreshKey((prev) => prev + 1);
          window.dispatchEvent(new Event("resetYouTubeUploader"));
          if (selectedBot?.status === "In Progress") {
            await authApi.updateBotStatusActive(selectedBot.id, {
              status: "Active",
              is_active: true,
            });
          }
        } catch (error) {
          console.error("Error processing YouTube videos:", error);
          toast.error("Failed to process YouTube videos.");
        } finally {
          // Reset button state
          setIsVideoProcessing(false);
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
      console.log("Missing required data for deletion:", {
        confirmDelete,
        botId: selectedBot?.id,
      });
      setConfirmDelete(null);
      return;
    }

    try {
      const videoId = extractVideoId(confirmDelete);
      if (!videoId) {
        console.error("Could not extract video ID from URL:", confirmDelete);
        toast.error(
          "Failed to delete video: Could not extract video ID from URL."
        );
        setConfirmDelete(null);
        return;
      }
      console.log("Deleting videoId:", videoId, "from botId:", selectedBot.id);

      // Find the video in the youtubeVideos array to get the transcript_count
      const videoToDelete = youtubeVideos.find(
        (v) => v.video_url === confirmDelete
      );
      const wordCount = videoToDelete?.transcript_count || 0;

      console.log("Deleting video with word count:", wordCount);

      // Delete the video and pass the word count
      console.log("Calling API with params:", {
        botId: selectedBot.id,
        videoId,
        wordCount,
      });
      const response = await authApi.deleteVideo(
        selectedBot.id,
        videoId,
        wordCount
      );
      console.log("Delete API response:", response);

      if (response?.data?.message) {
        toast.success(
          `Video deleted successfully.`
        );

        // Update the user usage statistics if possible
        try {
          const apiUsage = await authApi.getUserUsage();
          setUserUsage((prev) => ({
            ...prev,
            globalWordsUsed: apiUsage.totalWordsUsed,
          }));
          console.log("Updated user usage after deletion");
        } catch (error) {
          console.error(
            "Failed to refresh user usage after video deletion:",
            error
          );
        }

        // Update videos list
        setYoutubeVideos((prevVideos) => {
          const newVideos = prevVideos.filter(
            (video) => video.video_url !== confirmDelete
          );
          console.log(
            "Updated videos list. Previous count:",
            prevVideos.length,
            "New count:",
            newVideos.length
          );
          return newVideos;
        });
      } else {
        console.warn("Unexpected API response format:", response);
        toast.warning(
          "Video was deleted successfully"
        );
      }
    } catch (error: any) {
      console.error("Error deleting video:", error);
      if (error.response) {
        console.error(
          "API error response:",
          error.response.status,
          error.response.data
        );
      }
      toast.error("Failed to delete YouTube video. Please try again.");
    } finally {
      setConfirmDelete(null);
    }
  };

  const cancelDeletion = () => {
    setConfirmDelete(null);
  };

  const handleReconfigure = async () => {
    if (!selectedBot?.id || !status) return;
    try {
      // Update bot status to "Reconfiguring" and set is_active to false
      const response = await authApi.updateBotFields(selectedBot.id, {
        status: "Reconfiguring",
        is_active: false,
      });

      setStatus({
        ...status,
        overall_status: "reconfiguring",
        progress: {
          files: { ...status.progress.files, status: "reconfiguring" },
          websites: { ...status.progress.websites, status: "reconfiguring" },
          youtube: { ...status.progress.youtube, status: "reconfiguring" }
        }
      });

      if (response.success) {
        // Update local state
        setSelectedBot({
          ...selectedBot,
          status: "Reconfiguring",
          is_active: false, 
        });

      } else {
        toast.error("Failed to start reconfiguration");
      }
    } catch (error) {
      console.error("Error updating bot status:", error);
      toast.error("Failed to start reconfiguration");
    } finally {
      setIsReconfiguring(false);
    }
    // setIsConfigured(true); 
    setIsConfigured(true);
    localStorage.setItem("isConfigured", "true");
    setIsReconfiguring(true);
    setActiveTabLock(true);
    toast.info("You can now make changes. Click Retrain when done.");
  };

  const handleCancel = async () => {
    console.log("hasWebChanges=>",hasWebChanges)
    if ((!isSaveDisabled && newFiles.length > 0) || 
      isVideoSelected || 
      hasWebChanges||isScrapeButtonVisible) {
    toast.error("You have unsaved changes. Please save them before canceling.");
    return;
  }
    if (!selectedBot?.id || !status) return;
    try {
      // Update bot status to "Reconfiguring" and set is_active to false
      const response = await authApi.updateBotFields(selectedBot.id, {
        status: "Pending",
        is_active: false,
      });

      setStatus({
        ...status,
        overall_status: "Pending",
        progress: {
          files: { ...status.progress.files, status: "Pending" },
          websites: { ...status.progress.websites, status: "Pending" },
          youtube: { ...status.progress.youtube, status: "Pending" }
        }
      });
      await authApi.cancel_training(selectedBot.id);
      if (response.success) {
        // Update local state
        setSelectedBot({
          ...selectedBot,
          status: "Pending",
          is_active: false,
        });
      if (refetchScrapedUrls) refetchScrapedUrls();

      } else {
        toast.error("Failed to Cancel");
      }
    } catch (error) {
      console.error("Error updating bot status:", error);
      toast.error("Failed to Cancel");
    } finally {
      setIsReconfiguring(false);
    }
    setIsReconfiguring(false);
    setActiveTabLock(false);
    // setIsConfigured(false);
    setIsConfigured(false);
    localStorage.removeItem("isConfigured");
  };

  const handleRetrain = async () => {
    if ((!isSaveDisabled && newFiles.length > 0) || 
      isVideoSelected || 
      hasWebChanges|| isScrapeButtonVisible) {
    toast.error("You have unsaved changes. Please save them before retraining.");
    return;
  }
    if (!selectedBot?.id || !status) return;
    try {
      setIsConfigured(false)
      setIsRetraining(true);

      // 1. First reset reconfiguring state to allow WS updates
      setIsReconfiguring(false);

      const response = await authApi.updateBotFields(selectedBot.id, {
        status: "Retraining",
        is_active: false,
        is_retrained: true
      });



      // 2. Manually set status to "Training" for immediate UI feedback
      setStatus({
        ...status,
        overall_status: "Retraining",
        progress: {
          files: { ...status.progress.files, status: "Retraining" },
          websites: { ...status.progress.websites, status: "Retraining" },
          youtube: { ...status.progress.youtube, status: "Retraining" }
        }
      });

      const processResponse = await authApi.update_processed_with_training(selectedBot.id);
      // 4. Force refresh status from backend
      refreshStatus();
      if (response.success) {
        // Update local state
        setSelectedBot({
          ...selectedBot,
          status: "Retraining",
          is_active: false,
          //is_trained: true 
        });

      } else {
        toast.error("Failed to start Retraining");
      }
      // Step 3: Start training via Celery
      const celeryStartResponse = await authApi.startTraining(selectedBot.id);

      if (!celeryStartResponse.success) {

          toast.error("Failed to trigger training");
          return;
            }

    } catch (error) {
      toast.error("Retraining failed");
      // Rollback to reconfiguring state if failed
      setIsReconfiguring(true);
    } finally {
      setIsRetraining(false);
    }
  };

  // Function to extract video ID from URL
  const extractVideoId = (videoUrl: string) => {
    try {
      // Format: youtube.com/watch?v=VIDEO_ID
      if (videoUrl.includes("youtube.com/watch")) {
        const urlParams = new URLSearchParams(new URL(videoUrl).search);
        return urlParams.get("v");
      }

      // Format: youtu.be/VIDEO_ID
      if (videoUrl.includes("youtu.be/")) {
        const pathname = new URL(videoUrl).pathname;
        return pathname.split("/")[1]; // Get the ID after the slash
      }

      console.error("Unsupported YouTube URL format:", videoUrl);
      return null;
    } catch (error) {
      console.error("Error extracting video ID:", error);
      return null;
    }
  };

  // Fetch files when the component mounts or when selectedBot changes
  const fetchFiles = useCallback(async () => {
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
          size:
            file.original_file_size_bytes ||
            parseFileSizeToBytes(file.file_size), // Fallback to extracted size if original not available
          displaySize: String(file.original_file_size_bytes) || file.file_size,
          uploadDate: new Date(file.upload_date),
          url: file.file_path,
          wordCount: file.word_count,
          charCount: file.character_count,
          status: file.status,
          error_code: file.error_code,
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
  }, [selectedBot?.id]);

  // Place the websocket hook here:

const debounceTimeout = useRef<number | null>(null);
const prevStatus = useRef<any>(null);

useEffect(() => {
  if (!selectedBot?.id || !gridStatus) return;

  // Check if there are any changes in the relevant counts compared to previous status
  const shouldFetchFiles = prevStatus.current?.files &&
    (gridStatus.files.extracting !== prevStatus.current.files.extracting ||
     gridStatus.files.extracted !== prevStatus.current.files.extracted ||
     gridStatus.files.embedding !== prevStatus.current.files.embedding ||
     gridStatus.files.success !== prevStatus.current.files.success ||
     gridStatus.files.failed !== prevStatus.current.files.failed);

  const shouldFetchYouTube = prevStatus.current?.youtube &&
    (gridStatus.youtube.extracting !== prevStatus.current.youtube.extracting ||
     gridStatus.youtube.extracted !== prevStatus.current.youtube.extracted ||
     gridStatus.youtube.embedding !== prevStatus.current.youtube.embedding ||
     gridStatus.youtube.success !== prevStatus.current.youtube.success ||
     gridStatus.youtube.failed !== prevStatus.current.youtube.failed);

  const shouldFetchWebsites = prevStatus.current?.websites &&
    (gridStatus.websites.extracting !== prevStatus.current.websites.extracting ||
     gridStatus.websites.extracted !== prevStatus.current.websites.extracted ||
     gridStatus.websites.embedding !== prevStatus.current.websites.embedding ||
     gridStatus.websites.success !== prevStatus.current.websites.success ||
     gridStatus.websites.failed !== prevStatus.current.websites.failed);

  // Update previous status
  prevStatus.current = gridStatus;

  // Only proceed if there are actual changes
  if (!shouldFetchFiles && !shouldFetchYouTube && !shouldFetchWebsites) {
    return;
  }

  if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

  debounceTimeout.current = setTimeout(() => {
    if (shouldFetchFiles) fetchFiles();
    if (shouldFetchYouTube) fetchYouTubeVideos();
    if (shouldFetchWebsites && refetchScrapedUrls) refetchScrapedUrls();
  }, 1000);

  return () => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
  };
}, [gridStatus, selectedBot?.id]);

useEffect(() => {
  console.log("Grid WebSocket connected:", isGridWsConnected);
}, [isGridWsConnected]);

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

  const formatBytesToHumanReadable = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = (bytes / Math.pow(k, i)).toFixed(2);
    return size + " " + sizes[i];
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!isReconfiguring) {
        toast.error("Please click Reconfigure first before uploading files");
        return;
      }
      if (remainingWords <= 0) {
        toast.error(
          "You've reached your word limit. Please upgrade your plan."
        );
        return;
      }

      // Check storage limit
      const newFilesTotalSize = acceptedFiles.reduce(
        (sum, file) => sum + file.size,
        0
      );
      if (totalStorageUsed + newFilesTotalSize > userUsage.storageLimit) {
        toast.error(
          `Uploading these files would exceed your storage limit of ${formatBytesToHumanReadable(
            userUsage.storageLimit
          )}`
        );
        return;
      }

      // Check for duplicate file names (case-insensitive)
      const allFileNames = [
        ...existingFiles.map((f) => f.name.toLowerCase()),
        ...newFiles.map((f) => f.name.toLowerCase()),
      ];

      const duplicateFiles = acceptedFiles.filter((file) =>
        allFileNames.includes(file.name.toLowerCase())
      );

      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles
          .map((f) => `"${f.name}"`)
          .join(", ");
        toast.error(
          `Cannot upload files with duplicate names: ${duplicateNames}. ` +
          `Please rename the file(s) or delete the existing ones before uploading.`
        );
        return;
      }

      // Check each file's size before processing
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE
      );

      if (oversizedFiles.length > 0) {
        toast.error(
          `Files exceed the ${userPlan?.per_file_size_limit
          }MB limit: ${oversizedFiles.map((f) => f.name).join(", ")}`
        );
        return;
      }

      setIsProcessingFiles(true);

      try {
        // Process word counts for new files
        const counts = await processWordCounts(acceptedFiles);

        let newWords = 0;
        let newStorage = 0;
        const validFiles: FileUploadInterface[] = [];
        let hasExceededLimit = false;

        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i];
          const countData = counts[i];

          if (countData.error) {
            console.log(`File ${file.name} has error:`, countData.error);
            toast.error(`${file.name}: ${countData.error}`);
            continue;
          }

          const fileWords = countData.word_count || 0;
          const fileSize = file.size;

          if (totalWordsUsed + fileWords > userUsage.planLimit) {
            toast.error(`Skipped "${file.name}" - would exceed word limit`);
            continue;
          }
          if (
            totalStorageUsed + newStorage + fileSize >
            userUsage.storageLimit
          ) {
            toast.error(`Skipped "${file.name}" - would exceed storage limit`);
            continue;
          }

          validFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            size: 0,
            displaySize: formatBytesToHumanReadable(file.size),
            uploadDate: new Date(),
            url: URL.createObjectURL(file),
            file,
            wordCount: fileWords,
            charCount: countData.character_count,
          });

          newWords += fileWords;
          newStorage += fileSize;
        }
        // Only show success message if files were actually added
        setNewFiles((prev) => [...prev, ...validFiles]);
        setTotalSize((prev) => prev + newStorage);
        setUserUsage((prev) => ({
          ...prev,
          currentSessionWords: prev.currentSessionWords + newWords,
          currentSessionStorage: prev.currentSessionStorage + newStorage,
        }));

        if (validFiles.length > 0) {
          toast.success("Files added successfully");
        }
      } catch (error) {
        console.error("Error processing files:", error);
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [
      isReconfiguring,
      totalWordsUsed,
      totalStorageUsed,
      userUsage.planLimit,
      userUsage.storageLimit,
    ]
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



        // Update global words used
        const apiUsage: UserUsageResponse = await authApi.getUserUsage();
        setUserUsage((prev) => ({
          ...prev,
          globalWordsUsed: apiUsage.totalWordsUsed,
          globalStorageUsed: apiUsage.totalStorageUsed,
        }));
      } else {
        // File is in newFiles - just remove from state
        setNewFiles((prev) => prev.filter((file) => file.id !== id));
        setUserUsage((prev) => ({
          ...prev,
          currentSessionWords:
            prev.currentSessionWords - (fileToDelete.wordCount || 0),
          currentSessionStorage:
            prev.currentSessionStorage - (fileToDelete.size || 0),
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
    if (!selectedBot || isSaving) {
      toast.error("No bot selected.");
      return;
    }
    //setIsSaving(true);

    if (totalWordsUsed > userUsage.planLimit) {
      toast.error(
        `Total word count exceeds limit of ${userUsage.planLimit.toLocaleString()}`
      );
      setIsSaving(false);
      return;
    }
    if (totalStorageUsed > userUsage.storageLimit) {
      toast.error(
        `Total file size exceeds storage limit of ${formatBytesToHumanReadable(
          userUsage.storageLimit
        )}`
      );
      return;
    }

    setIsSaving(true);

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

        const newWords = newFiles.reduce(
          (acc, file) => acc + (file.wordCount || 0),
          0
        );
        const newStorage = newFiles.reduce(
          (acc, file) => acc + (file.size || 0),
          0
        );


        const apiUsage = await authApi.getUserUsage();
        setUserUsage({
          globalWordsUsed: apiUsage.totalWordsUsed,
          currentSessionWords: 0,
          planLimit: apiUsage.planLimit,
          globalStorageUsed: apiUsage.totalStorageUsed || 0,
          currentSessionStorage: 0,
          storageLimit: parseStorageLimit(userPlan?.storage_limit || "20 MB"),
        });

        setNewFiles([]);
        await fetchFiles();
        toast.success("Files saved successfully");
        if (selectedBot?.status === "In Progress") {
          await authApi.updateBotStatusActive(selectedBot.id, {
            status: "Active",
            is_active: true,
          });
        }
      } else {
        //toast.info("No new files to save");
      }
    } catch (error) {
      toast.error("An error occurred while saving files");
    } finally {
      setIsSaving(false); // Re-enable the button when done
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
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
  });

  const getFileExtension = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? extension.toUpperCase() : "UNKNOWN";
  };

  const handleTabClick = (tab: string) => {
    if (tab === "websitescraping" || tab === "websiteSub") {
      // Determine the tab based on the user's subscription_plan_id
      setActiveTab(
        user.subscription_plan_id === 1 || user.subscription_plan_id === 2
          ? "websitescraping"
          : "websiteSub"
      );
    } else {
      setActiveTab(tab);
    }
  };

  const filteredYoutubeVideos = React.useMemo(() => {
  return youtubeVideos.filter((video) => {
    const matchesSearch =
      (video.video_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (video.video_url || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (video.status || "").toLowerCase() === statusFilter;

    return matchesSearch && matchesStatus;
  });
}, [youtubeVideos, searchTerm, statusFilter]);

const filteredFiles = React.useMemo(() => {
  const list = allFiles || [];
  return list.filter((file) => {
    const q = (fileSearchTerm || "").toLowerCase();
    const matchesSearch =
      (file.name || "").toLowerCase().includes(q) ||
      (file.url || "").toLowerCase().includes(q);

    const matchesStatus =
      fileStatusFilter === "all" ||
      ((file.status || "").toLowerCase() === fileStatusFilter);

    return matchesSearch && matchesStatus;
  });
}, [allFiles, fileSearchTerm, fileStatusFilter]);



  if (!selectedBot) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="text-gray-500 dark:text-white text-lg">
          No bot selected.
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BotTrainingStatusProgress 
      status={status} 
      selectedBot={selectedBot} 
      isConnected={isConnected}
      refreshStatus={refreshStatus}
    />
      <ToastContainer />
      {/* {loading && <Loader />} */}

     {/* Tabs Section */}

      <div className="flex justify-between items-center w-full border-b border-gray-300 dark:border-gray-700">

        <div className="flex">
          <button
            onClick={() => handleTabClick("websitescraping")}
            className={`px-4 py-2 ${activeTab === "websitescraping" || activeTab === "websiteSub"
                ? "border-b-2 border-[color:#5348CB] text-[color:#5348CB] "
                : "text-gray-500"
              }`}
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            Website
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`px-4 py-2 ${activeTab === "files"
                ? "border-b-2 border-[color:#5348CB] text-[color:#5348CB] "
                : "text-gray-500"
              }`}
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            Files
          </button>
          <button
            onClick={() => setActiveTab("youtube")}
            className={`px-4 py-2 ${activeTab === "youtube"
                ? "border-b-2 border-[color:#5348CB] text-[color:#5348CB] "
                : "text-gray-500"
              }`}

          >
            YouTube Videos
          </button>
        </div>

        <div className="flex items-center space-x-4 pb-2">
            <button
            onClick={handleReconfigure}
            className={`px-4 py-2 rounded-md transition-colors ${
              status?.overall_status === "reconfiguring" || 
              isReconfiguring ||
              status?.overall_status === "Training" || 
              status?.overall_status === "Retraining"
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#5348CB] text-white hover:bg-[#4339b6]"
            }`}
            disabled={
              status?.overall_status === "reconfiguring" || 
              isReconfiguring ||
              status?.overall_status === "Training" || 
              status?.overall_status === "Retraining"
            }
          >
            Reconfigure
          </button>
          <button
            onClick={handleCancelClick}
            className={`px-4 py-2 rounded-md transition-colors ${status?.overall_status !== "reconfiguring" && !isReconfiguring
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#5348CB] text-white hover:bg-[#4339b6]"
              }`}
            disabled={status?.overall_status !== "reconfiguring" && !isReconfiguring}
          >
            Cancel
          </button>

          {showCancelWarning && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-lg font-bold mb-4">Warning</h2>
                <p className="mb-4">
                  All changes made during reconfiguration will be lost if you cancel. Are you sure you want to proceed?
                </p>
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={handleCancelClose}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    Proceed Anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleRetrain}
            className={`px-4 py-2 rounded-md transition-colors ${status?.overall_status !== "reconfiguring" && !isReconfiguring
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-[#5348CB] text-white hover:bg-[#4339b6]"
              }`}
            disabled={status?.overall_status !== "reconfiguring" && !isReconfiguring || isSaving}
          >
            {isRetraining ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin inline" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Retraining...
              </>
            ) : (
              "Retrain"
            )}
          </button>
        </div>
      </div>

      <div>
        {activeTab === "websitescraping" &&
          (user.subscription_plan_id === 1 ||
            user.subscription_plan_id === 2) && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white p-3">
                Website Scraping
              </h1>
              <WebScrapingTab
              isReconfiguring={isReconfiguring}
              isCreateBotFlow={false}
              setRefetchScrapedUrls={setRefetchScrapedUrls}
              selectedNodes={selectedNodes}
              setSelectedNodes={setSelectedNodes}
              nodes={nodes}
              setNodes={setNodes}
              onChangesMade={() => setHasWebChanges(true)}
              onScrapeButtonVisibility={(isVisible) => setIsScrapeButtonVisible(isVisible)}
/>
            </div>
          )}

        {activeTab === "websiteSub" &&
          (user.subscription_plan_id === 3 ||
            user.subscription_plan_id === 4) && (
            <div>
              {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white p-3 border-b border-pink-500">
              Enter the Website URL
            </h1> */}
              <SubscriptionScrape isReconfiguring={isReconfiguring}    isConfigured={isConfigured}  setRefetchScrapedUrls={setRefetchScrapedUrls}
              onScrapeButtonVisibility={(isVisible) => setIsScrapeButtonVisible(isVisible)} />
            </div>
          )}
        {/* Files Tab Content */}


      </div>
      <div >
        {activeTab === "files" && (
          <>
            {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            File Upload
          </h1> */}

            <h1
              style={{
                fontFamily: "Instrument Sans, sans-serif",
                fontSize: "20px",
                color: "#333333",
                fontWeight: "bold",
                marginBottom: "20px",
              }}
            >
              Manage Files
            </h1>

            {/* Dropzone */}
            <div
              {...getRootProps({
                onClick: (e) => {
                  if (!isReconfiguring) {
                    e.stopPropagation();
                    toast.error("Please click Reconfigure first before uploading files");
                    return false; // Important: prevent dropzone from handling the click
                  }
                  return undefined; // Let dropzone handle the click normally
                }
              })}

              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover-[#5348CB] transition-colors relative   "
              style={{ backgroundColor: "#F8FDFF" }}

            >
              {/* <input {...getInputProps()} disabled={!isReconfiguring} />
              {isProcessingFiles && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center rounded-lg ">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <p className="text-gray-600">{processingMessage}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    This may take a moment...
                  </p>
                </div>
              )} */}
             <input {...getInputProps()} disabled={!isConfigured} />
                {!isConfigured && (
                <div className="absolute inset-0 z-30 cursor-not-allowed" style={{ pointerEvents: 'all' }} />
                  )}
              {isProcessingFiles && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center rounded-lg ">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <p className="text-gray-600">{processingMessage}</p>
              <p className="text-xs text-gray-500 mt-1">
              This may take a moment...
              </p>
              </div>
              )}    
              <img
                src="/images/dummy/folder.png"
                alt="Upload Icon"
                className="mx-auto h-12 w-12 object-contain"
              />
              <p
                style={{
                  fontFamily: '"Instrument Sans", sans-serif',
                  fontSize: "14px",
                  fontWeight: "400",
                  color: "#333",
                }}
                className="text-gray-600 dark:text-gray-400"
              >
                {isDragActive
                  ? "Drop the files here..."
                  : "Drag & drop files here, or click to select files"}
              </p>
              <p
                style={{
                  fontFamily: '"Instrument Sans", sans-serif',
                  fontSize: "12px",
                  fontWeight: "400",
                  color: "#666",
                }}
                className="text-gray-600 dark:text-gray-400"
              >
                Maximum {userUsage.planLimit.toLocaleString()} words total,{" "}
                {userPlan?.per_file_size_limit}MB per file (PDF, TXT, Docx,
                .png, .jpg, .jpeg, .gif files only)
              </p>
            </div>

            <div className="flex flex-wrap justify-between gap-4  ">
              <div className="flex-[0_0_48%] py-4 bg-white dark:bg-gray-700 rounded-lg ">
                {/* Title */}
                <div>
                  <span
                    className="text-gray-700 dark:text-gray-300"
                    style={{
                      fontFamily: "Instrument Sans, sans-serif",
                      fontSize: "18px",
                      fontWeight: 600,
                    }}
                  >
                    Word Usage
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mt-2">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${usagePercentage}%`,
                      background:
                        remainingWords <= 0
                          ? "#ef4444"
                          : remainingWords < userUsage.planLimit * 0.2
                            ? "#f59e0b"
                            : "linear-gradient(to right, #665AD7, #9D9CFF)",
                    }}
                  ></div>
                </div>

                {/* Usage Text Below Bar */}
                <div className="mt-1 text-sm text-gray-500">
                  {totalWordsUsed.toLocaleString()} / {userUsage.planLimit.toLocaleString()}
                  {userUsage.currentSessionWords > 0 && (
                    <span className="ml-2">
                      (Current Bot: {userUsage.currentSessionWords.toLocaleString()})
                    </span>
                  )}
                </div>

                {/* Warnings */}
                {remainingWords <= 0 ? (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    You've reached your word limit! Remove files or upgrade your plan.
                  </div>
                ) : remainingWords < userUsage.planLimit * 0.2 ? (
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    Approaching word limit ({Math.round(usagePercentage)}% used)
                  </div>
                ) : null}
              </div>
              <div className="flex-[0_0_48%] py-4 bg-white dark:bg-gray-700 rounded-lg">
                {/* Title */}
                <div>
                  <span
                    className="text-gray-700 dark:text-gray-300"
                    style={{
                      fontFamily: "Instrument Sans, sans-serif",
                      fontSize: "18px",
                      fontWeight: 600,
                    }}
                  >
                    Storage
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mt-2">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${storageUsagePercentage}%`,
                      background:
                        remainingStorage <= 0
                          ? "#ef4444"
                          : remainingStorage < userUsage.storageLimit * 0.2
                            ? "#f59e0b"
                            : "linear-gradient(to right, #665AD7, #9D9CFF)",
                    }}
                  ></div>
                </div>

                {/* Usage Text Below Bar */}
                <div className="text-gray-700 dark:text-gray-300"
                  style={{
                    fontFamily: "Instrument Sans, sans-serif",
                    fontSize: "12px",
                    fontWeight: 400,
                  }}>
                  {formatBytesToHumanReadable(totalStorageUsed)} /{" "}
                  {formatBytesToHumanReadable(userUsage.storageLimit)}
                  {userUsage.currentSessionStorage > 0 && (
                    <span className="ml-2">
                      (This session:{" "}
                      {formatBytesToHumanReadable(userUsage.currentSessionStorage)})
                    </span>
                  )}
                </div>

                {/* Warning or Info */}
                {remainingStorage <= 0 ? (
                  <div className="mt-2 text-sm font-medium text-red-500 dark:text-red-400 text-left">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    You've reached your storage limit! Remove files or upgrade your plan.
                  </div>
                ) : remainingStorage < userUsage.storageLimit * 0.2 ? (
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    Approaching storage limit ({Math.round(storageUsagePercentage)}% used)
                  </div>
                ) : null}
              </div>

            </div>
              <div className="p-4  border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Uploaded Files
                </h2>
              </div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                      {/* File Search */}
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <input
                          value={fileSearchTerm}
                          onChange={(e) => setFileSearchTerm(e.target.value)}
                          placeholder="Search files by name"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-10 py-2 text-sm outline-none"
                        />
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-70" />
                      </div>

                      {/* File Status Dropdown (dynamic) */}
                      <div className="relative">
                        <select
                          value={fileStatusFilter}
                          onChange={(e) => setFileStatusFilter(e.target.value)}
                          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-8 py-2 text-sm"
                        >
                          <option value="all">All </option>
                          {Array.from(new Set((allFiles || []).map(f => (f.status || "").toLowerCase())))
                            .filter(Boolean)
                            .map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                        </select>
                        <Filter className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
                      </div>
                    </div>
            {/* Files Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ">

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
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Words
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
                    {filteredFiles && filteredFiles.length > 0 ? (
                       filteredFiles.map((file, index) => (

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
                            {getFileExtension(file.name)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm relative overflow-visible">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {file.status || "Pending"}
                          </span>

                          {file.status === "Failed" && file.error_code && (
                            <div className="relative group cursor-pointer">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <div
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                                          bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-100
                                          border border-gray-300 dark:border-gray-700 rounded px-2 py-1
                                          shadow-lg z-50 max-w-xs w-max whitespace-normal break-words"
                              >
                                {file.error_code}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {file.wordCount?.toLocaleString() || "N/A"}
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
                            className={`text-red-600 hover:text-red-900 dark:hover:text-red-400 ${
                                !isReconfiguring ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              disabled={!isReconfiguring}
                            >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        {fileSearchTerm !== "" || fileStatusFilter !== "all"
                          ? "No files match your search criteria. Try adjusting your filters."
                          : "No files found. Upload some files to get started."
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleSave}
                disabled={isSaveDisabled || isSaving}
                className={`w-[102px] h-[43px] px-4 py-2 bg-[#5348CB] text-white rounded-lg hover:bg-[#4339b6] disabled:bg-gray-400 disabled:cursor-not-allowed  ${isSaving ? "opacity-75" : ""
                  }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>

            </div>
          </>
        )}
      </div>
      {/* YouTube Videos Tab Content */}
      {activeTab === "youtube" && (
        <div className="bg-white p-6 relative" style={{ border: '1px solid #DFDFDF', borderRadius: '13px' }}>
          {/* Show upgrade message only for plans 1 and 2 */}
          {[1, 2].includes(user.subscription_plan_id) && (
            <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-lg pointer-events-auto">
              <YouTubeUpgradeMessage requiredPlan="Growth" />
            </div>
          )}

          <div className={[1, 2].includes(user.subscription_plan_id) ? "pointer-events-none opacity-50" : ""}>
            <h1 style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "20px",
              color: "#333333",
              fontWeight: "bold",
              marginBottom: "20px",
            }}>
              YouTube Videos
            </h1>
            <YouTubeUploader
              isReconfiguring={isReconfiguring}
              maxVideos={remainingVideos}
              refreshKey={refreshKey}
              isConfigured={isConfigured}
              setIsVideoSelected={setIsVideoSelected}
            />

            <div className="p-2" >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Added Videos
              </h2>

            </div>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by title or URL"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-10 py-2 text-sm outline-none"
                    />
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-70" />
                  </div>

                  {/* Status dropdown (dynamic options from youtubeVideos) */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-8 py-2 text-sm"
                    >
                      <option value="all">All </option>
                      {Array.from(new Set(youtubeVideos.map(v => (v.status || "").toLowerCase())))
                        .filter(Boolean)
                        .map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                    </select>
                    <Filter className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
                  </div>
                </div>

            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md "
              style={{

                border: '1px solid #DFDFDF',
                borderRadius: '13px'
              }}>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                   
                    <tr style={{ backgroundColor: '#EFF0FF',height: '57px',fontFamily: 'Instrument Sans, sans-serif',fontSize: '16px',fontWeight: '600',color:"black" }}>
                       <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                            textTransform:'none'
                          }}
                        >
                        S.No
                      </th>
                      <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                            textTransform:'none'
                          }}
                        >
                        Title
                      </th>
                      <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                           textTransform:'none'
                          }}
                        >
                        Status
                       </th>
                      <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                            textTransform:'none'
                          }}
                        >
                        Video URL
                      </th>
                       <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                            textTransform:'none'
                          }}
                        >
                        Words
                      </th>
                      <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                            textTransform:'none'
                          }}
                        >
                        Upload Date
                      </th>
                      <th
                          className="px-6 py-3 text-left uppercase tracking-wider"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#333333',
                            textTransform:'none'
                          }}
                        >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredYoutubeVideos && filteredYoutubeVideos.length > 0 ? (
      filteredYoutubeVideos.map((videoUrl, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {videoUrl.video_title || "Untitled"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm relative overflow-visible z-0">
                          <div className="flex items-center gap-1">
                            <span>{videoUrl.status}</span>
                            {videoUrl.status === "Failed" && videoUrl.error_code && (
                              <div className="relative group cursor-pointer">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <div
                                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                                            bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-100
                                            border border-gray-300 dark:border-gray-700 rounded px-2 py-1
                                            shadow-lg z-50 max-w-xs w-max whitespace-normal break-words"
                                >
                                  {videoUrl.error_code}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a
                            href={videoUrl.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {videoUrl.video_url}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-white">
                          {videoUrl.transcript_count}
                        </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                          {videoUrl.upload_date
                            ? new Date(videoUrl.upload_date).toLocaleDateString()
                            : "N/A"}
                        </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() =>
                              handleVideoDelete(videoUrl.video_url)
                            }
                            className={`text-red-600 hover:text-red-900 dark:hover:text-red-400 ${
                                !isReconfiguring ? 'opacity-30 cursor-not-allowed' : ''
                              }`}
                              disabled={!isReconfiguring}
                            >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))) : (
                      (searchTerm !== "" || statusFilter !== "all") && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            No videos match your search criteria. Try adjusting your filters.
                          </td>
                        </tr>
                      )
                    )}
                    </tbody>
                </table>
              </div>

            </div>
            <div className="mt-4">
              <button
                onClick={handleFinish}
                className=" w-[102px]  h-[40px]  bg-blue-500 text-white rounded-lg hover:bg-[#5348CB] disabled:bg-[#AAAAAA] disabled:cursor-not-allowed"

                style={{
                  backgroundColor: isVideoSelected ? "#5348CB" : "#AAAAAA",
                }}
                disabled={!isVideoSelected || isVideoProcessing}
              >
                {isVideoProcessing ? (
                  <span className="flex items-center">
                    <Loader2 className="w-[102px] h-[48px]  animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "SAVE"
                )}
              </button>

            </div>

          </div>
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
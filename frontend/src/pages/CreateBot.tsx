import { formatUiDate } from "../utils/date";
import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  Upload,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
} from "lucide-react";
import { File as FileIcon, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authApi } from "../services/api";
import { CreateBotInterface } from "../types";
import { useBot } from "../context/BotContext";
import YouTubeUploader from "./YouTubeUploader";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import SubscriptionScrape from "./SubscriptionScrape";
import WebScrapingTab from "./WebScrapingTab.tsx";
import { UserUsage } from "../types/index";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";
import  handleScrape  from "./WebScrapingTab.tsx";
import { TrainingDataTab } from "./TrainingDataTab";
import { ChevronDown } from 'lucide-react';
import { useSearchParams,useLocation } from "react-router-dom";


interface Step {
  title: string;
  description: string;
  icon: React.FC<{ className?: string }> | string;
}

interface FileWithCounts 
  extends Omit<CreateBotInterface, "wordCount" | "charCount"> {
  wordCount?: number;
  charCount?: number;
  loadingCounts?: boolean;
  error?: string;
  file: File;
  status?: string;
}

interface UploadFilesResponse {
  success: boolean;
  uploaded_files?: Array<{
    file_id: string;
    file_name: string;
  }>;
 }

const steps: Step[] = [
  {
    title: "Name your bot",
    description: "Give your chatbot a unique and identifiable name.",
    icon: "/images/dummy/message-icon.png",
  },
  {
    title: "Add knowledge base",
    description:
      "Add your website, youtube URL or upload documents that will serve as the knowledge base for your chatbot.",
    icon: "/images/dummy/knowledge-base-icon.png",
  },

  {
    title: "Training",
    description:
      "Train your bot with the provided knowledge base.",
    icon: "/images/dummy/knowledge-base-icon.png",
  },
];

const YouTubeUpgradeMessage = ({ requiredPlan = "Growth" }) => {
  return (
    <div className="absolute top-0 left-0 right-0 bottom--3 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg ">
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-lg max-w-sm mx-4">
        <Lock className="w-5 h-1 mx-auto text-gray-400 mb-0" />
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

export const CreateBot = () => {
  const { selectedBot, setSelectedBot } = useBot();
  const navigate = useNavigate();
  //const [currentStep, setCurrentStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [files, setFiles] = useState<FileWithCounts[]>([]);
  const[website,scrapedUrls]=useState<FileWithCounts[]>([]);
  const [botName, setBotName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loading, setLoading } = useLoader();
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [botId, setBotId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  const { getPlanById } = useSubscriptionPlans();
  const userPlan = getPlanById(user?.subscription_plan_id);
  const [hasYouTubeVideos, setHasYouTubeVideos] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingSaveWeb, setIsLoadingSaveWeb] = useState(false);
  const [isLoadingSaveFiles, setIsLoadingSaveFiles] = useState(false);
  const [isLoadingSaveYouTube, setIsLoadingSaveYouTube] = useState(false);
  const [searchParams] = useSearchParams();
  const urlBotId = searchParams.get('botId');
  const urlStep = searchParams.get('step');
  const [hasAnyExistingContent, setHasAnyExistingContent] = useState(false);
  const [userBotCount, setUserBotCount] = useState(0);
  const [maxBotsAllowed, setMaxBotsAllowed] = useState(0);
  const location = useLocation();

// Initialize currentStep based on URL
  const [currentStep, setCurrentStep] = useState(urlStep ? parseInt(urlStep) : 0);
  const [bots, setBots] = useState<Bot[]>([]);
  const [processingMessage, setProcessingMessage] = useState(
    "Getting things ready for you..."
  );
  const [useExternalKnowledge, setUseExternalKnowledge] = useState(false);
  const [hasExternalKnowledgeEntitlement, setHasExternalKnowledgeEntitlement] = useState<boolean | null>(null);
  const MAX_FILE_SIZE = (userPlan?.per_file_size_limit ?? 20) * 1024 * 1024;
  console.log("Maxfilesize=>", MAX_FILE_SIZE);
  const MAX_WORD_COUNT = userPlan?.word_count_limit ?? 50000;
  console.log("Word count limit", MAX_WORD_COUNT);
  const parseStorageLimit = (limitStr: string): number => {
    // Define the units with explicit type
    type UnitKey = "KB" | "MB" | "GB" | "TB";
    const units: Record<UnitKey, number> = {
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };

    const match = limitStr.match(/^(\d+)\s*(KB|MB|GB|TB)$/i);
    if (!match) return 20 * 1024 ** 2; // Default 20MB if parsing fails

    // Convert to uppercase and assert as UnitKey type
    const unit = match[2].toUpperCase() as UnitKey;
    return parseInt(match[1]) * units[unit];
  };
  const [userUsage, setUserUsage] = useState({
    globalWordsUsed: 0,
    currentSessionWords: 0,
    planLimit: userPlan?.word_count_limit ?? 50000,
    globalStorageUsed: 0,
    currentSessionStorage: 0,
    storageLimit: parseStorageLimit(userPlan?.storage_limit ?? "20 MB"),
  });

  // Derived values
  const totalWordsUsed =
    userUsage.globalWordsUsed + userUsage.currentSessionWords;
  const remainingWords = Math.max(0, userUsage.planLimit - totalWordsUsed);
  const usagePercentage = Math.min(
    100,
    (totalWordsUsed / userUsage.planLimit) * 100
  );
  const totalStorageUsed =
    userUsage.globalStorageUsed ;
    console.log("userUsage.globalStorageUsed",userUsage.globalStorageUsed)
  const remainingStorage = Math.max(
    0,
    userUsage.storageLimit - totalStorageUsed
  );
  const storageUsagePercentage = Math.min(
    100,
    (totalStorageUsed / userUsage.storageLimit) * 100
  );
const [hasWebChanges, setHasWebChanges] = useState(false);
const [hasFileChanges, setHasFileChanges] = useState(false);
const [hasYouTubeChanges, setHasYouTubeChanges] = useState(false);
const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
const [hasWebsiteContent, setHasWebsiteContent] = useState(false);
const [hasYouTubeContent, setHasYouTubeContent] = useState(false);
const isCreateBotFlow = location.pathname.includes('/dashboard/create-bot');
const [hasScraped, setHasScraped] = useState(false);
// Add state for the refresh function
const [refetchScrapedUrls, setRefetchScrapedUrls] = useState<(() => void) | undefined>();

useEffect(() => {
  const fetchBotLimits = async () => {
    try {
      // Get user's current bot count
      const botResponse = await authApi.getBotSettingsByUserId(user?.user_id);
      const botCount = botResponse.length;
      setUserBotCount(botCount);
      
      // Get user's plan limits
      const userPlan = getPlanById(user?.subscription_plan_id);
      setMaxBotsAllowed(userPlan?.chatbot_limit || 0);
    } catch (error) {
      console.error("Error fetching bot limits:", error);
    }
  };
  
  fetchBotLimits();
}, [user?.user_id, user?.subscription_plan_id, getPlanById]);

useEffect(() => {
  const checkForExistingContent = async () => {
    if (!selectedBot?.id) return;
    
    try {
      // Check all content types in parallel
      const [files, youtubeVideos, scrapedUrls] = await Promise.all([
        authApi.getFiles(selectedBot.id),
        authApi.fetchVideosForBot(selectedBot.id),
        authApi.getScrapedUrls(selectedBot.id)
      ]);
      
      setHasAnyExistingContent(
        files.length > 0 || 
        youtubeVideos.length > 0 || 
        scrapedUrls.length > 0
      );
      console.log("status of all=>",files.length > 0 || 
        youtubeVideos.length > 0 || 
        scrapedUrls.length > 0)
      if (youtubeVideos.length > 0){
      setHasYouTubeContent(true)
      }
      if (scrapedUrls.length > 0){
      setHasWebsiteContent(true)
      }
    } catch (error) {
      console.error("Error checking existing content:", error);
    }
  };
  
  checkForExistingContent();
}, [selectedBot?.id,currentStep]);

// Load bot data if URL has botId
useEffect(() => {
  // First check location state for bot data
  if (location.state?.botId) {
    setBotId(location.state.botId);
    if (location.state.botName) {
      setBotName(location.state.botName);
    }
    // If coming from draft, we already have the bot
    if (location.state.fromDraft) {
      setSelectedBot({
        id: location.state.botId,
        name: location.state.botName,
        status: "Draft",
        conversations: 0,
        satisfaction: 0
      });
      
      // If coming from draft and URL has step=1, stay on step 1
      if (urlStep === '1') {
        setCurrentStep(1);
      }
    }
  }

  // Then check URL params if no state
  else if (urlBotId) {
    setBotId(parseInt(urlBotId));
  }
}, [location.state, urlBotId, urlStep]);


 useEffect(() => {
  if (selectedBot?.id) {
    fetchFiles();
    //fetchYouTubeVideos(); // For YouTube videos
  }
}, [selectedBot?.id, currentStep]);


useEffect(() => {
  // When CreateBot is freshly loaded, and we are on step 1 (YouTube step),
  // clear any previous YouTube selections
  if (urlStep === "1") {
    localStorage.removeItem("selected_videos");
    localStorage.removeItem("youtube_video_urls");
    setHasYouTubeVideos(false);
    setHasYouTubeChanges(false);
    window.dispatchEvent(new Event("resetYouTubeUploader"));
  }
}, []); 

  // Fetch user usage on component mount
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const apiUsage = await authApi.getUserUsage();
        const mappedUsage = {
          globalWordsUsed: apiUsage.totalWordsUsed,
          currentSessionWords: 0,
          planLimit: apiUsage.planLimit,
          globalStorageUsed: apiUsage.totalStorageUsed || 0, // Make sure to get storage used from API
          currentSessionStorage: 0,
          storageLimit: parseStorageLimit(userPlan?.storage_limit ?? "20 MB"), // Use the plan's storage limit
        };

        setUserUsage(mappedUsage);
      } catch (error) {
        console.error("Failed to fetch user usage", error);
        // Fallback to plan defaults if API fails
        setUserUsage((prev) => ({
          ...prev,
          storageLimit: parseStorageLimit(userPlan?.storage_limit ?? "20 MB"),
        }));
      }
    };
    fetchUsage();
  }, []);

  // Prefetch External Knowledge entitlement for the current user
  useEffect(() => {
    (async () => {
      try {
        const result = await authApi.checkExternalKnowledgeForUser();
        setHasExternalKnowledgeEntitlement(!!result?.hasExternalKnowledge);
      } catch (e) {
        setHasExternalKnowledgeEntitlement(false);
      }
    })();
  }, []);

  const processWordCounts = async (filesToProcess: File[]) => {
    const formData = new FormData();
    filesToProcess.forEach((file) => formData.append("files", file));

    try {
      const response = await authApi.getWordCount(formData);

      // Check for error response structure
      if (Array.isArray(response) && response[0]?.error) {
        throw new Error(response[0].error);
      }

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("Error getting word counts:", error);

      // Show toast with the error message
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to process word counts");
      }

      throw error;
    }
  };

  const fetchFiles = useCallback(async () => {
  if (!selectedBot?.id) return;

  try {
    const fetchedFiles = await authApi.getFiles(selectedBot.id);
    const formattedFiles = fetchedFiles.map((file) => ({
      id: file.file_id.toString(),
      name: file.file_name,
      type: file.file_type,
      size: file.original_file_size_bytes || parseFileSizeToBytes(file.file_size),
      uploadDate: new Date(file.upload_date),
      url: file.file_path,
      wordCount: file.word_count,
      charCount: file.character_count,
      status:file.status
    }));
    setFiles(formattedFiles);
  } catch (error) {
    console.error("Failed to fetch files:", error);
  }
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

  const onDrop = useCallback(
  async (acceptedFiles: File[]) => {
    // Set flag that files have been changed
    setHasFileChanges(true);

    // 1. Check word limit
    if (remainingWords <= 0) {
      toast.error("You've reached your word limit. Please upgrade your plan.");
      return;
    }

    // 2. Check storage limit
    const newFilesTotalSize = acceptedFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );
    if (totalStorageUsed + newFilesTotalSize > userUsage.storageLimit) {
      toast.error(
        `Uploading these files would exceed your storage limit of ${formatFileSize(
          userUsage.storageLimit
        )}`
      );
      return;
    }

    // 3. Check for duplicate file names (case-insensitive)
    const existingFileNames = files.map((f) => f.name.toLowerCase());
    const duplicateFiles = acceptedFiles.filter((file) =>
      existingFileNames.includes(file.name.toLowerCase())
    );

    if (duplicateFiles.length > 0) {
      const duplicateNames = duplicateFiles
        .map((f) => `"${f.name}"`)
        .join(", ");
      toast.error(
        `File(s) with the same name already exist: ${duplicateNames}. ` +
          `Please rename the file(s) or remove the existing ones before uploading.`
      );
      return;
    }

    // 4. Check each file's size before processing
    const oversizedFiles = acceptedFiles.filter(
      (file) => file.size > MAX_FILE_SIZE
    );

    if (oversizedFiles.length > 0) {
      const oversizedNames = oversizedFiles
        .map((f) => `"${f.name}" (${formatFileSize(f.size)})`)
        .join(", ");
      toast.error(
        `The following files exceed the size limit of ${formatFileSize(
          MAX_FILE_SIZE
        )}: ${oversizedNames}`
      );
      // Continue with valid files
      if (acceptedFiles.length === oversizedFiles.length) return;
    }

    // Only process files that passed all validations
    const validSizeFiles = acceptedFiles.filter(
      (file) => file.size <= MAX_FILE_SIZE
    );

    if (validSizeFiles.length === 0) return;

    setIsProcessingFiles(true);
    setProcessingMessage("Processing your files...");

    try {
      // Initialize progress tracking
      const newProgress: Record<string, number> = {};
      validSizeFiles.forEach((file) => {
        newProgress[file.name] = 0;
      });
      setUploadProgress(newProgress);

      // Process word counts for new files
      const counts = await processWordCounts(validSizeFiles);

      let newWords = 0;
      let newStorage = 0;
      const validFiles: FileWithCounts[] = [];

      for (let i = 0; i < validSizeFiles.length; i++) {
        const file = validSizeFiles[i];
        const countData = counts[i];

        // Update progress for this file
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 30, // 30% after word count processing
        }));

        if (countData.error) {
          console.log(`File ${file.name} has error:`, countData.error);
          toast.error(`${file.name}: ${countData.error}`);
          continue;
        }

        const fileWords = countData.word_count || 0;
        const fileSize = file.size;

        // Check if adding this file would exceed limits
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
          id: Math.random().toString(36).substr(2, 9), // Temp ID until saved
          name: file.name,
          type: file.type,
          size: 0,
          uploadDate: new Date(),
          url: URL.createObjectURL(file),
          file: file,
          wordCount: fileWords,
          charCount: countData.character_count,
          loadingCounts: false,
        });

        newWords += fileWords;
        newStorage += fileSize;

        // Update progress
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 60, // 60% after validation
        }));
      }

      // Add all valid files at once
      setFiles((prev) => [...prev, ...validFiles]);
      setUserUsage((prev) => ({
        ...prev,
        currentSessionWords: prev.currentSessionWords + newWords,
        currentSessionStorage: prev.currentSessionStorage + newStorage,
      }));

      // Update progress to complete
      validFiles.forEach((file) => {
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 100,
        }));
      });

      if (validFiles.length > 0) {
        toast.success(
          validFiles.length === 1
            ? "1 file added successfully"
            : `${validFiles.length} files added successfully`
        );
      }
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error(
        "An error occurred while processing files. Please try again."
      );
    } finally {
      setTimeout(() => {
        setUploadProgress({});
        setIsProcessingFiles(false);
      }, 500); // Small delay to show completion
    }
  },
  [
    files,
    remainingWords,
    totalStorageUsed,
    totalWordsUsed,
    userUsage.storageLimit,
    userUsage.planLimit,
    MAX_FILE_SIZE,
  ]
);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
    maxSize: MAX_FILE_SIZE,
    onDropRejected: (rejectedFiles) => {
      const rejectedReasons = {
        fileType: new Set<string>(),
        fileSize: new Set<string>(),
      };

      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((err) => {
          if (err.code === "file-too-large") {
            rejectedReasons.fileSize.add(
              `"${file.name}" (${formatFileSize(file.size)})`
            );
          } else if (err.code === "file-invalid-type") {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext) rejectedReasons.fileType.add(`.${ext}`);
          }
        });
      });

      if (rejectedReasons.fileSize.size > 0) {
        toast.error(
          `The following files exceed the size limit of ${formatFileSize(
            MAX_FILE_SIZE
          )}: ${Array.from(rejectedReasons.fileSize).join(", ")}`
        );
      }

      if (rejectedReasons.fileType.size > 0) {
        toast.error(
          `Unsupported file types: ${Array.from(rejectedReasons.fileType).join(
            ", "
          )}. ` + `Please upload only supported file types.`
        );
      }
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = (bytes / Math.pow(k, i)).toFixed(2);
    return size + " " + sizes[i];
  };

  console.log("userUsage.storageLimit=>", userUsage.storageLimit);
  console.log(
    "userUsage.storageLimit FormatFileSize=>",
    formatFileSize(userUsage.storageLimit)
  );
const handleDelete = async (id: string) => {
  if (!selectedBot?.id) return;

  const fileToDelete = files.find(file => file.id === id);
  if (!fileToDelete) return;

  try {
    const deletedWordCount = fileToDelete.wordCount || 0;
    const deletedFileSize = fileToDelete.size || 0;

    // Determine if this is a saved file (has numeric ID) or unsaved
    const isSavedFile = /^\d+$/.test(id);

    if (isSavedFile) {
      // For saved files: delete from server and update backend counts
      await authApi.deleteFile(id);
  
      // Update local state to reflect the deletion
      setUserUsage(prev => ({
        ...prev,
        globalWordsUsed: Math.max(0, prev.globalWordsUsed - deletedWordCount),
        globalStorageUsed: Math.max(0, prev.globalStorageUsed - deletedFileSize),
      }));
    } else {
      // For unsaved files: just update local session counts
      setUserUsage(prev => ({
        ...prev,
        currentSessionWords: Math.max(0, prev.currentSessionWords - deletedWordCount),
        currentSessionStorage: Math.max(0, prev.currentSessionStorage - deletedFileSize),
      }));
    }

    // Remove from files state
    setFiles(prev => prev.filter(file => file.id !== id));

    toast.success("File deleted successfully");
  } catch (error) {
    console.error("Error deleting file:", error);
    toast.error("Failed to delete file");
  }
};
  const getFileExtension = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? extension.toUpperCase() : "UNKNOWN";
  };

  const updateBotName = async (
    botId: number,
    newName: string
  ): Promise<boolean> => {
    try {
      const response = await authApi.updateBotName({
        bot_id: botId,
        bot_name: newName,
      });

      if (response.success) {
        toast.success("Bot name updated successfully");
        return true;
      } else {
        toast.error("We couldn't update your bot name");
        return false;
      }
    } catch (error: any) {
      console.error("Error updating bot name:", error);

      // Check for specific error message from backend
      if (
        error.response?.data?.detail ===
        "A bot with this name already exists for the user"
      ) {
        toast.error(
          "A bot with this name already exists. Please choose a different name."
        );
      } else {
        toast.error("We couldn't update your bot name. Please try again.");
      }
      return false;
    }
  };

  const createBotEntry = async (botName: string) => {
    try {
      const response = await authApi.createBot({
        bot_name: botName,
        status: "Draft",
        is_active: false,
        external_knowledge: useExternalKnowledge,
      });

      if (!response.bot_id) {
        throw new Error("Bot ID not found in response");
      }

      return response.bot_id;
    } catch (error: any) {
      // Check if this is a duplicate name error
      if (
        error.response?.data?.detail ===
        "A bot with this name already exists for the user"
      ) {
        throw new Error("DUPLICATE_NAME");
      }
      throw new Error("We couldn't create your bot. Please try again.");
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
    if (!botId && userBotCount >= maxBotsAllowed) {
      toast.error(
        `You already have ${userBotCount} bots. Your plan allows only ${maxBotsAllowed} bot(s). Upgrade to create more.`
      );
      return;
    }
      if (!botName.trim()) {
        toast.error("Please enter a bot name.");
        return;
      }

      if (botId) {
        // Update existing bot
        const updateSuccess = await updateBotName(botId, botName);
        if (!updateSuccess) return;

        setSelectedBot({
          id: botId,
          name: botName,
          status: "In Progress",
          conversations: 0,
          satisfaction: 0,
        });
      } else {
        try {
          localStorage.removeItem("youtube_video_urls");
          localStorage.removeItem("selected_videos");
          setHasYouTubeVideos(false);  
          const newBotId = await createBotEntry(botName);
          setBotId(newBotId);
          setSelectedBot({
            id: newBotId,
            name: botName,
            status: "In Progress",
            conversations: 0,
            satisfaction: 0,
          });
        } catch (error: any) {
          if (error.message === "DUPLICATE_NAME") {
            toast.error(
              "A bot with this name already exists. Please choose a different name."
            );
          } else {
            toast.error("Failed to create bot entry. Please try again.");
          }
          return;
        }
      }
      
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 1) {


      if (hasWebChanges || hasFileChanges || hasYouTubeChanges) {
      toast.error("Please save your changes before proceeding");
      return;
    }
    if (hasWebsiteContent  || files.length > 0 || hasYouTubeContent) {
        setCurrentStep(currentStep + 1);
      } else {
        toast.error("Please add at least one knowledge source (website, files, or YouTube videos)");
      }
       
    //setCurrentStep(currentStep + 1);
  } else if (currentStep < steps.length - 1) {
    // For other steps just advance
    setHasWebChanges(false);
    setHasFileChanges(false);
    setHasYouTubeChanges(false);
    setCurrentStep(currentStep + 1);
  }
};

  const handleBack = () => {

    if (currentStep === 1 && (hasWebChanges || hasFileChanges || hasYouTubeChanges)) {
    toast.error("Please save your changes before going back");
    return;
  }
  if (currentStep === 2 ) {
    setHasScraped(false);
  }

    if (currentStep === 0) {
      navigate("/",{ state: { botName,
        botId,
        fromDraft: !!location.state?.fromDraft
       } });
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  
  const handleSaveWebContent = async () => {
  if (!selectedBot?.id || selectedNodes.length === 0) return;
  
  try {
    setIsLoadingSaveWeb(true);
    const data = await authApi.scrapeNodesAsync(selectedNodes, selectedBot.id);
    
    if (data.status === "processing") {
      
      localStorage.setItem("isScraped", "1");
      setSelectedNodes([]); 
      setNodes([]); 
      setWebsiteUrl("");
      setHasWebChanges(false);
      setHasScraped(true);
      // Refresh the scraped URLs table after a short delay
      setTimeout(() => {
        if (refetchScrapedUrls) {
          refetchScrapedUrls();
        }
      }, 1000); // 1 second delay to allow backend to start processing

      
      toast.info("Your website content is being prepared. We'll notify you when it's ready.");
      setHasWebsiteContent(true);
    }
  } catch (error) {
    toast.error("Failed to start web scraping");
  } finally {
    setIsLoadingSaveWeb(false);
  }
};

const handleSaveFiles = async () => {
  if (!selectedBot?.id) return;
  
  try {
    setIsLoadingSaveFiles(true);
    let uploadedFileIds: string[] = [];
    let totalWords = 0;
    let totalSize = 0;

    // First upload files if there are new ones
    if (files.length > 0) {
      // Separate new files (with File objects) from existing ones
      const newFiles = files.filter(file => file.file);
      const existingFiles = files.filter(file => !file.file);

      if (newFiles.length > 0) {
        const formData = new FormData();
        newFiles.forEach((file) => {
          if (file.file) formData.append("files", file.file);
        });
        formData.append("word_counts", JSON.stringify(newFiles.map(f => f.wordCount)));
        formData.append("char_counts", JSON.stringify(newFiles.map(f => f.charCount)));
        formData.append("bot_id", selectedBot.id.toString());

        const uploadResponse = await authApi.uploadFilesWithCounts(formData) as UploadFilesResponse;
        
        if (!uploadResponse.success) {
          throw new Error("File upload failed");
        }

        // Get the uploaded file IDs
        if (uploadResponse.uploaded_files) {
          uploadedFileIds = uploadResponse.uploaded_files.map(f => f.file_id);
        }

        // Update files state with new IDs
        const updatedFiles = files.map((file, index) => {
          // Only update IDs for new files
          if (file.file && uploadedFileIds[index]) {
            return {
              ...file,
              id: uploadedFileIds[index]
            };
          }
          return file;
        });

        setFiles(updatedFiles);
      }

      // Calculate totals from all files (new and existing)
      totalWords = files.reduce((sum, file) => sum + (file.wordCount || 0), 0);
      totalSize = files.reduce((sum, file) => sum + file.size, 0);
    }
    // if (updateResponse.success) {
      setHasFileChanges(false);
      toast.success("Files saved successfully");
      
      // Update user usage - move current session to global
      setUserUsage((prev) => ({
        ...prev,
        globalWordsUsed: prev.globalWordsUsed + prev.currentSessionWords,
        globalStorageUsed: prev.globalStorageUsed ,
        currentSessionWords: 0,
        currentSessionStorage: 0,
      }));

      // Refresh files list from server to ensure consistency
      const refreshedFiles = await authApi.getFiles(selectedBot.id);
      const formattedFiles = refreshedFiles.map((file) => ({
        id: file.file_id.toString(),
        name: file.file_name,
        type: file.file_type,
        size: 0,
        //file.original_file_size_bytes || parseFileSizeToBytes(file.file_size),
        uploadDate: new Date(file.upload_date),
        url: file.file_path,
        wordCount: file.word_count,
        charCount: file.character_count,
      }));
      setFiles(formattedFiles);
    
  } catch (error) {
    console.error("Error saving files:", error);
    toast.error(
      error instanceof Error 
        ? error.message 
        : "Failed to save files. Please try again."
    );
  } finally {
    setIsLoadingSaveFiles(false);
  }
};


const handleSaveYouTube = async () => {
  if (!selectedBot?.id) return;
  
  try {
    setIsLoadingSaveYouTube(true);
    const savedSelectedVideos = localStorage.getItem("selected_videos");
    const parsedSelectedVideos = savedSelectedVideos
      ? JSON.parse(savedSelectedVideos)
      : [];

    if (parsedSelectedVideos.length > 0) {
      const response = await authApi.storeSelectedYouTubeTranscripts(
        parsedSelectedVideos,
        selectedBot.id
      );
      if (response && response.message) {
         
        localStorage.removeItem("selected_videos"); // Clear selected videos
        localStorage.removeItem("youtube_video_urls"); // Clear video URLs
        setHasYouTubeChanges(false);
        setHasYouTubeVideos(false);
        // ✅ Explicitly clear state in uploader
        const savedVideoState = localStorage.getItem("selected_videos");
        if (savedVideoState) {
          localStorage.removeItem("selected_videos");
        }

        // ✅ Use window.dispatchEvent to send global reset event like a hack
        window.dispatchEvent(new Event("resetYouTubeUploader"));
        toast.info("Your YouTube videos are being processed. We'll notify you when they're ready.");
        setHasYouTubeContent(true);
      }
    }
  } catch (error) {
    toast.error("Failed to process YouTube videos");
  } finally {
    setIsLoadingSaveYouTube(false);
  }
};

  const handleFinish = async () => {
    console.log("=== STARTING BOT FINALIZATION ===");
    console.log("Current state before submission:", {
      files,
      userUsage,
      totalWordsUsed,
      remainingWords,
    });
    const isScraped = localStorage.getItem("isScraped") === "1";
    const totalWordCount = files.reduce(
      (acc, file) => acc + (file.wordCount || 0),
      0
    );

    if (totalWordCount > MAX_WORD_COUNT) {
      toast.error(
        `Total word count exceeds limit of ${MAX_WORD_COUNT.toLocaleString()}. Please remove some files or upgrade your plan.`
      );
      return;
    }
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > userUsage.storageLimit) {
      toast.error(
        `Total file size exceeds your storage limit of ${formatFileSize(userUsage.storageLimit)}`
      );
      return;
    }

    setIsLoadingSaveFiles(true);
    setIsLoadingSaveFiles(true);
    try {
      if (selectedBot?.id) {
        console.log(
          "Updating bot word count with:",
          userUsage.currentSessionWords
        );


        // Update global words used after successful submission
        setUserUsage((prev) => {
          const newUsage = {
            ...prev,
            globalWordsUsed: prev.globalWordsUsed + prev.currentSessionWords,
            globalStorageUsed:
              prev.globalStorageUsed + prev.currentSessionStorage,
            currentSessionWords: 0,
            currentSessionStorage: 0,
          };
          console.log("Updating userUsage after submission:", newUsage);
          return newUsage;
        });
      }

      let isUploadSuccess = false;
      let isYouTubeSuccess = false;

      const filesToUpload = files.map((file) => ({
        file: file.file,
        wordCount: file.wordCount,
        charCount: file.charCount,
      }));

      if (filesToUpload.length > 0) {
        const formData = new FormData();
        filesToUpload.forEach((fileData) => {
          formData.append("files", fileData.file!);
        });
        formData.append(
          "word_counts",
          JSON.stringify(filesToUpload.map((f) => f.wordCount))
        );
        formData.append(
          "char_counts",
          JSON.stringify(filesToUpload.map((f) => f.charCount))
        );
        formData.append("bot_id", botId!.toString());
        if (selectedBot?.id) {
        console.log(
          "Updating bot word count with:",
          userUsage.currentSessionWords
        );

        //const response = await authApi.uploadFilesWithCounts(formData);
        const response = await authApi.startTraining(selectedBot.id);
        console.log("Backend response:", response);

        if (response.success) {
          isUploadSuccess = true;
          toast.success(`File uploaded successfully!`);
        } else {
          toast.error("Failed to upload files.");
        }
      }}

      const savedSelectedVideos = localStorage.getItem("selected_videos");
      const parsedSelectedVideos = savedSelectedVideos
        ? JSON.parse(savedSelectedVideos)
        : [];
      console.log("parsedSelectedVideos", parsedSelectedVideos);

      if (selectedBot?.id && parsedSelectedVideos.length > 0) {
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
          if (responseyoutube && responseyoutube.message && (
                        responseyoutube.message.includes("processing started") ||
                        responseyoutube.message.includes("Video processing") ||
                        responseyoutube.message.includes("background") ||
                        responseyoutube.status === "processing"
                      )) {
                      toast.info(
                        "Your YouTube videos are being processed. We'll notify you when they're ready."
                      );
                    }
        } catch (error) {
          console.error("Error processing YouTube videos:", error);
          toast.error("Failed to process YouTube videos.");
        }
      }

      // ✅ Check if at least one source is provided
      if (!(isUploadSuccess || isYouTubeSuccess || isScraped)) {
        setIsLoadingNext(false);
        setIsLoadingNext(false);
        toast.error(
          "Please upload at least one file, one YouTube video, or scrape one website to create a bot."
        );

        return;
      }

      if (selectedBot?.id) {
        try {
          console.log("updateBotStatusActive");
          await authApi.updateBotStatusActive(selectedBot.id, {
            status: "Active",
            is_active: true,
          });

          setSelectedBot({
            id: selectedBot.id,
            name: botName,
            status: "Active",
            conversations: 0,
            satisfaction: 0,
          });

          //toast.success("Your bot is now ready to use!");
        } catch (error) {
          console.error("Error updating bot status:", error);
          toast.error("We couldn't activate your bot. Please try again.");
        }
      }

      setTimeout(() => {
        localStorage.removeItem("youtube_video_urls");
        localStorage.removeItem("selected_videos");
        //navigate("/dashboard/upload");
        setCurrentStep(currentStep + 1);
      }, 7000);
    } catch (error) {
      console.error("Error creating bot:", error);
      toast.error("An error occurred while uploading files.");
    } finally {
      setIsLoading(false);
      setLoading(false);
      // Log final state
      setTimeout(() => {
        console.log('=== AFTER FINALIZATION COMPLETE ===');
        console.log('Final files:', files);
        console.log('Final userUsage:', userUsage);
        console.log('Final derived values:', {
          totalWordsUsed,
          remainingWords,
          usagePercentage
        });
      }, 0);
    }
  };

  const handleCheckboxChange = (url: string) => {
    if (selectedNodes.includes(url)) {
      setSelectedNodes((prev) => prev.filter((node) => node !== url));
    } else {
      if (selectedNodes.length >= 10) {
        toast.error(
          "You are on the Free Tier! Upgrade your subscription to select more pages."
        );
        return;
      }
      setSelectedNodes((prev) => [...prev, url]);
    }
  };

//   const handleTrainBot = () => {
//   setIsLoading(true);
//   // Show loader for 3 seconds
//   setTimeout(() => {
//     setIsLoading(false);
//     navigate("/dashboard/upload");
//   }, 3000);
// };

const handleTrainBot = async () => {
  if (!selectedBot?.id) return;
  
  setIsLoading(true);
  try {
    // Update bot status to "Training" and set is_active to false
    const response = await authApi.updateBotFields(selectedBot.id, {
      status: "Training",
      is_active: false,
      is_trained: true 
    });

    if (response.success) {
      // Update local state
      setSelectedBot({
        ...selectedBot,
        status: "Training",
        is_active: false,
        is_trained: true 
      });

      const processResponse  = await authApi.update_processed_with_training (selectedBot.id);

      // Step 3: Training via Celery
      // Step 3: Start training via Celery
      const celeryStartResponse = await authApi.startTraining(selectedBot.id);

      if (!celeryStartResponse.success) {
        setIsLoading(false);
        toast.error("Failed to trigger training");
        return;
      }

      if (processResponse.success) {
      // Show loader for 3 seconds before redirecting
      setTimeout(() => {
        setIsLoading(false);
        navigate("/dashboard/upload");
      }, 3000);
    }else {
        setIsLoading(false);
        toast.error("Failed to mark processed training");
      }
    }  
    else {
      setIsLoading(false);
      toast.error("Failed to start training");
    }
  } catch (error) {
    console.error("Error updating bot status:", error);
    setIsLoading(false);
    toast.error("Failed to start training");
  }
};

const renderStepContent = () => {
  const [expandedSections, setExpandedSections] = useState({
    webScraping: false,
    fileUpload: false,
    youtubeUpload: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  switch (currentStep) {
    case 0:
      return (
        <div className="space-y-4">
          <input
            type="text"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Bot name"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />

          <div className="pt-6">
            <label
              className="block font-medium mb-2"
              style={{
                color: "#333333",
                fontFamily: "Instrument Sans, sans-serif",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              External Knowledge
            </label>

            <div className="flex flex-col space-y-4">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  className="hidden"
                  name="knowledgeSource"
                  checked={!useExternalKnowledge}
                  onChange={() => setUseExternalKnowledge(false)}
                />
                <span
                  className={`h-4 w-4 mr-2 inline-block rounded-full border-2 flex items-center justify-center ${
                    !useExternalKnowledge ? "border-blue-600 bg-blue-600" : "border-gray-400"
                  }`}
                  style={{
                    borderColor: !useExternalKnowledge ? "#5348CB" : "#9CA3AF",
                    backgroundColor: !useExternalKnowledge ? "#5348CB" : "transparent"
                  }}
                ></span>
                <span
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  style={{
                    fontFamily: "Instrument Sans, sans-serif",
                    fontSize: "16px",
                    fontWeight: "400",
                    color: "#000000",
                  }}
                >
                  Only provided knowledge
                </span>
              </label>

              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  className="hidden"
                  name="knowledgeSource"
                  checked={useExternalKnowledge}
                  onChange={() => {
                    if (!user?.user_id) {
                      toast.error("Please log in to enable external knowledge.");
                      setUseExternalKnowledge(false);
                      return;
                    }
                    if (hasExternalKnowledgeEntitlement === true) {
                      setUseExternalKnowledge(true);
                      return;
                    }
                    if (hasExternalKnowledgeEntitlement === false) {
                      toast.info("External Knowledge is an add-on. Please purchase it to enable this feature.");
                      setUseExternalKnowledge(false);
                      return;
                    }
                    // Fallback if entitlement not yet loaded
                    toast.info("Checking your add-on entitlement. Please try again in a moment.");
                  }}
                />
                <span
                  className={`h-4 w-4 mr-2 inline-block rounded-full border-2 flex items-center justify-center ${
                    useExternalKnowledge ? "border-blue-600 bg-blue-600" : "border-gray-400"
                  }`}
                  style={{
                    borderColor: useExternalKnowledge ? "#5348CB" : "#9CA3AF",
                    backgroundColor: useExternalKnowledge ? "#5348CB" : "transparent"
                  }}
                ></span>
                <span
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                  style={{
                    fontFamily: "Instrument Sans, sans-serif",
                    fontSize: "16px",
                    fontWeight: "400",
                    color: "#000000",
                  }}
                >
                  Include external knowledge when needed
                </span>
              </label>
            </div>

            <p
              className="mt-2 text-xs text-gray-500 dark:text-gray-400"
              style={{
                fontFamily: "Instrument Sans, sans-serif",
                fontSize: "14px",
                color: "#666666",
              }}
            >
              When enabled, external knowledge helps answer questions beyond
              your provided content.
            </p>
          </div>
        </div>
      );

    case 1:
      return (
        <div className="space-y-4">
          {/* Web Scraping Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100"
              onClick={() => toggleSection('webScraping')}
            >
              <div className="flex items-center">
                <Globe className="w-5 h-5 mr-3 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">Add Website Content</h3>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  expandedSections.webScraping ? 'transform rotate-180' : ''
                }`}
              />
            </button>
            {expandedSections.webScraping && (
              <div className="p-4">
                  <WebScrapingTab 
                    selectedNodes={selectedNodes} 
                    setSelectedNodes={setSelectedNodes} 
                    nodes={nodes}
                    setNodes={setNodes}
                    onChangesMade={() => setHasWebChanges(true)} 
                    disableActions={true} 
                    disableActions2={hasScraped}
                    isCreateBotFlow={true}
                    setRefetchScrapedUrls={setRefetchScrapedUrls}
                  />
                 <div className="flex justify-start mt-4">
                  {/* <button
                    onClick={handleSaveWebContent}
                    disabled={!hasWebChanges || isLoadingSaveWeb}
                    className={`px-4 py-2 rounded-md text-white ${
                      hasWebChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isLoadingSaveWeb ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                    Save
                  </button> */}
                  <button
                  onClick={handleSaveWebContent}
                  disabled={!hasWebChanges || isLoadingSaveWeb || selectedNodes.length === 0}
                  className={`px-4 py-2 rounded-md ${
                  hasWebChanges && selectedNodes.length > 0
                  ? 'bg-[#5348CB] hover:bg-[#4338a1] text-white'
                  : 'bg-gray-400 text-black cursor-not-allowed'
                  }`}>
                  {isLoadingSaveWeb ? (
                  <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Saving...
                  </>
                   ) : (
                   'Save')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* File upload section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100"
              onClick={() => toggleSection('fileUpload')}
            >
              <div className="flex items-center">
                <Upload className="w-5 h-5 mr-3 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">Upload Files</h3>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  expandedSections.fileUpload ? 'transform rotate-180' : ''
                }`}
              />
            </button>
            {expandedSections.fileUpload && (
              <div className="p-4">
            
            {/* File Dropzone */}
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors relative"
              style={{ backgroundColor: "#F8FDFF" }}
            >
              <input {...getInputProps()} />
              {isProcessingFiles && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center">
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
              <p className="mt-2 text-sm text-gray-600">
                Drag and drop files here, or click to select files
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Maximum {userUsage.planLimit.toLocaleString()} words total,{" "}
                {userPlan?.per_file_size_limit}MB per file ((PDF, TXT,
                Docx, .png, .jpg, .jpeg, .gif files only))
              </p>
            </div>

            {/* Word Count and Storage Summary */}
            <div className="flex flex-wrap justify-between gap-4 mt-4">
              <div className="flex-[0_0_48%] p-4 bg-white dark:bg-gray-700 rounded-lg">
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
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mt-2 mb-2">
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
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: "#666666",
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontSize: "12px",
                    }}
                  >
                    {totalWordsUsed.toLocaleString()}/
                    {userUsage.planLimit.toLocaleString()} words
                    {userUsage.currentSessionWords > 0 && (
                      <span className="text-gray-500 ml-2">
                        (Current Bot:{" "}
                        {userUsage.currentSessionWords.toLocaleString()})
                      </span>
                    )}
                  </span>
                </div>
                {remainingWords <= 0 ? (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    You've reached your word limit! Remove files or upgrade your
                    plan.
                  </div>
                ) : remainingWords < userUsage.planLimit * 0.2 ? (
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    Approaching word limit ({Math.round(usagePercentage)}% used)
                  </div>
                ) : null}
              </div>

              <div className="flex-[0_0_48%] p-4 bg-white dark:bg-gray-700 rounded-lg">
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
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mt-2 mb-2">
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
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-sm font-medium"
                    style={{
                      color: "#666666",
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontSize: "12px",
                    }}
                  >
                    {formatFileSize(totalStorageUsed)}/
                    {formatFileSize(userUsage.storageLimit)}
                    {userUsage.currentSessionStorage > 0 && (
                      <span className="text-gray-500 ml-2">
                        (This bot:{" "}
                        {formatFileSize(userUsage.currentSessionStorage)})
                      </span>
                    )}
                  </span>
                </div>
                {remainingStorage <= 0 ? (
                  <div className="mt-2 text-xs text-red-500 dark:text-red-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    You've reached your storage limit! Remove files or upgrade
                    your plan.
                  </div>
                ) : remainingStorage < userUsage.storageLimit * 0.2 ? (
                  <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                    Approaching storage limit (
                    {Math.round(storageUsagePercentage)}% used)
                  </div>
                ) : null}
              </div>
            </div>

            {/* Uploaded Files Table */}
            <div className="bg-white mt-4">
              <div className="p-4">
                <h2
                  className="text-gray-900 dark:text-white"
                  style={{
                    fontSize: "18px",
                    color: "#333333",
                    fontWeight: 600,
                    fontFamily: "'Instrument Sans', sans-serif",
                  }}
                >
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
                    {files.length > 0 ? (
                      files.map((file) => (
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
                          <td className="px-6 py-4 whitespace-nowrap">
                         <span className="text-sm text-gray-500 dark:text-gray-400">
                          {file.status || "Pending"}
                         </span>
                       </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {file.loadingCounts ? (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : file.error ? (
                              <span className="text-xs text-red-500">
                                Error
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {file.wordCount?.toLocaleString() || "0"}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatFileSize(file.size)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatUiDate(file.uploadDate)}
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
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-4 text-center text-sm text-gray-500"
                        >
                          No files uploaded yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          <div className="flex justify-start mt-4">
      <button
        onClick={handleSaveFiles}
        disabled={!hasFileChanges || isLoadingSaveFiles}
        className={`px-4 py-2 rounded-md text-white ${
          hasFileChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        {isLoadingSaveFiles ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
        Save
      </button>
    </div>
  </div>
)}
            </div>

          {/* YouTube Upload Section */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100"
              onClick={() => toggleSection('youtubeUpload')}
            >
              <div className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-3 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">Add YouTube Videos</h3>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  expandedSections.youtubeUpload ? 'transform rotate-180' : ''
                }`}
              />
            </button>
            {expandedSections.youtubeUpload && (
              <div className="p-4 relative">
                <YouTubeUploader maxVideos={5}
                 setIsVideoSelected={setHasYouTubeVideos} 
                onChangesMade={() => setHasYouTubeChanges(true)}
                disableActions={true}/>
                <div className="flex justify-start mt-4">
                <button
                  onClick={handleSaveYouTube}
                  disabled={!hasYouTubeChanges || isLoadingSaveYouTube}
                  className={`px-4 py-2 rounded-md text-white ${
                    hasYouTubeChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoadingSaveYouTube ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : null}
                  Save
                </button>
              </div>
                {[1, 2].includes(user.subscription_plan_id) && (
                  <YouTubeUpgradeMessage requiredPlan="Growth" />
                )}
              </div>
            )}
          </div>
        </div>
      );

    case 2:
      return (
        <TrainingDataTab 
          botId={selectedBot?.id || null}
          onTrain={handleTrainBot}
          onCancel={handleBack}
          isLoading={isLoading}
        />
      );
    default:
      return null;
  }
};  
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white py-8  ">
      <ToastContainer autoClose={3000} />
      <div
        className="text-center text-[26px] "
        style={{
          fontFamily: "Instrument Sans, sans-serif",
          color: "#333333",
          fontWeight: 600,
        }}
      >
        Create Your Bot
      </div>

      <div className="max-w-3xl mx-auto px-4  ">
        <div className="flex items-center justify-between mt-8 mb-8 ml-6 mr-6  ">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex flex-col items-center justify-center  "
            >
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full ${
    index <= currentStep ? "text-white" : "bg-gray-200 text-gray-400"
  } ${index === currentStep ? "ring-4" : ""}`}
  style={{
    backgroundColor: index <= currentStep ? "#5348CB" : undefined,
    border: "2px solid",
    borderColor: index <= currentStep ? "#5FDC87" : undefined,
    boxShadow: index === currentStep ? "0 0 0 4px #5FDC87" : undefined,
  }}
              >
                {typeof step.icon === "string" ? (
                  <img src={step.icon} alt="Step icon" className="w-6 h-6 " />
                ) : (
                  <step.icon className="w-6 h-6" />
                )}
              </div>
              <p
                className={`mt-2  font-semibold text-[14px] font-instrument-sans    ${
                  index <= currentStep ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {step.title}
              </p>
            </div>
          ))}
        </div>
        <div
          className="p-10 pr-12 pl-12 mb-8 "
          style={{
            borderColor: "#DFDFDF",
            borderWidth: "1px",
            borderRadius: "20px",
            backgroundColor: "white", // add this if bg is transparent so border stands out
          }}
        >
          <div />
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2   ">
              {steps[currentStep].title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 ">
              {steps[currentStep].description}
            </p>
            {renderStepContent()}
    
            {/* Only show navigation buttons for non-training steps */}
            {currentStep !== 2 && (
              <div className="flex justify-start gap-x-3 m-2 mt-10">
                <button
                  onClick={handleBack}
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
                <button
                onClick={handleNext}
                disabled={
                  isLoadingNext || 
                  (currentStep === 0 && !botName.trim()) ||
                  (currentStep === 1 && !hasAnyExistingContent && files.length === 0 && !hasYouTubeContent && !hasWebsiteContent)
                }
                className={`flex items-center justify-center px-6 py-2 rounded-lg text-white font-medium min-w-[100px]
                  ${(isLoadingNext || 
                    (currentStep === 0 && !botName.trim()) ||
                    (currentStep === 1 && !hasAnyExistingContent && files.length === 0 && !hasYouTubeContent && !hasWebsiteContent)) 
                    ? "cursor-not-allowed bg-gray-400" : "cursor-pointer bg-blue-600 hover:bg-blue-700"}
                  transition-colors duration-200
                `}
              >
                {isLoadingNext ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Processing...
                  </>
                ) : "Next"}
              </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
   
  );
};

export default CreateBot;
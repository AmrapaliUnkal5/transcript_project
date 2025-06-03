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
}

const steps: Step[] = [
  {
    title: "Name your bot",
    description: "Give your chatbot a unique and identifiable name.",
    icon: "/images/dummy/message-icon.png",
  },
  {
    title: "Website information",
    description:
      "Add your website URL to help your bot understand the contents.",
    icon: Globe,
  },
  {
    title: "Add knowledge base",
    description:
      "Upload documents that will serve as the knowledge base for your chatbot.",
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

export const CreateBot = () => {
  const { selectedBot, setSelectedBot } = useBot();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [files, setFiles] = useState<FileWithCounts[]>([]);
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
  console.log("userPlan====>", userPlan);

  const [processingMessage, setProcessingMessage] = useState(
    "Getting things ready for you..."
  );
  const [useExternalKnowledge, setUseExternalKnowledge] = useState(false);
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
    userUsage.globalStorageUsed + userUsage.currentSessionStorage;
  const remainingStorage = Math.max(
    0,
    userUsage.storageLimit - totalStorageUsed
  );
  const storageUsagePercentage = Math.min(
    100,
    (totalStorageUsed / userUsage.storageLimit) * 100
  );

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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Filter out oversized files first
      const validSizeFiles = acceptedFiles.filter(
        (file) => file.size <= MAX_FILE_SIZE
      );
      const oversizedFiles = acceptedFiles.filter(
        (file) => file.size > MAX_FILE_SIZE
      );

      // Show error for oversized files immediately
      if (oversizedFiles.length > 0) {
        const oversizedNames = oversizedFiles
          .map((f) => `"${f.name}" (${formatFileSize(f.size)})`)
          .join(", ");
        toast.error(
          `The following files exceed the size limit of ${formatFileSize(
            MAX_FILE_SIZE
          )}: ${oversizedNames}`
        );
      }

      // If no valid files remain after size check, return early
      if (validSizeFiles.length === 0) return;

      // Rest of your existing checks (word limit, duplicates, etc.)
      if (remainingWords <= 0) {
        toast.error(
          "You've reached your word limit. Please upgrade your plan."
        );
        return;
      }

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
      const existingFileNames = files.map((f) => f.name.toLowerCase());
      const duplicateFiles = validSizeFiles.filter((file) =>
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

      setIsProcessingFiles(true);

      try {
        // Only process files that passed all validations
        const counts = await processWordCounts(validSizeFiles);

        let newWords = 0;
        let newStorage = 0;
        const validFiles: FileWithCounts[] = [];

        for (let i = 0; i < validSizeFiles.length; i++) {
          const file = validSizeFiles[i];
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
            size: file.size,
            uploadDate: new Date(),
            url: URL.createObjectURL(file),
            file: file,
            wordCount: fileWords,
            charCount: countData.character_count,
            loadingCounts: false,
          });

          newWords += fileWords;
          newStorage += fileSize;
        }

        setFiles((prev) => [...prev, ...validFiles]);
        setUserUsage((prev) => ({
          ...prev,
          currentSessionWords: prev.currentSessionWords + newWords,
          currentSessionStorage: prev.currentSessionStorage + newStorage,
        }));
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [
      totalWordsUsed,
      totalStorageUsed,
      userUsage.planLimit,
      userUsage.storageLimit,
      files,
      MAX_FILE_SIZE,
      remainingWords,
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
  const handleDelete = (id: string) => {
    setFiles((prevFiles) => {
      const fileToDelete = prevFiles.find((file) => file.id === id);
      if (!fileToDelete) {
        return prevFiles;
      }

      const deletedWordCount = fileToDelete.wordCount || 0;
      const deletedFileSize = fileToDelete.size || 0;

      setUserUsage((prev) => ({
        ...prev,
        currentSessionWords: Math.max(
          0,
          prev.currentSessionWords - deletedWordCount
        ),
        currentSessionStorage: Math.max(
          0,
          prev.currentSessionStorage - deletedFileSize
        ),
      }));

      return prevFiles.filter((file) => file.id !== id);
    });
  };

  const getFileExtension = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? extension.toUpperCase() : "UNKNOWN";
  };

  const fetchNodes = async (websiteUrl: string) => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await authApi.getWebsiteNodes(websiteUrl);
      if (data.nodes) {
        setNodes(data.nodes);
        setSelectedNodes([]);
      } else {
        setNodes([]);
        toast.error("No nodes found for this website.");
      }
    } catch (error) {
      console.error("Error fetching website nodes:", error);
      toast.error("Failed to fetch website nodes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getPaginatedNodes = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return nodes.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(nodes.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-4 py-2 mx-1 rounded-md ${
            currentPage === i
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {i}
        </button>
      );
    }
    return buttons;
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
        status: "In Progress",
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
      if (selectedNodes.length === 0) {
        // toast.error("Please select at least one page to scrape.");
        // return;
      }

      setIsLoading(true);

      try {
        if (!selectedBot?.id) {
          console.error("Bot ID is missing.");
          return;
        }
        const data = await authApi.scrapeNodesAsync(
          selectedNodes,
          selectedBot?.id
        );
        console.log("Scraping started:", data);

        if (data.status === "processing") {
          // toast.info("Web scraping has started. You will be notified when it's complete.");
          // toast.info("During bot creation, you can only scrape one website. To add more websites, go to bot settings after creation.");
          localStorage.setItem("isScraped", "1");
          setCurrentStep(currentStep + 1);
        } else {
          toast.error("Failed to start web scraping. Please try again.");
        }
      } catch (error) {
        console.error("Error scraping website:", error);
        toast.error("An error occurred while scraping. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigate("/Options");
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
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

    setIsLoading(true);
    setLoading(true);
    try {
      if (selectedBot?.id) {
        console.log(
          "Updating bot word count with:",
          userUsage.currentSessionWords
        );
        await authApi.updateBotWordCount({
          bot_id: selectedBot.id,
          word_count: userUsage.currentSessionWords,
          file_size: userUsage.currentSessionStorage,
        });

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

        const response = await authApi.uploadFilesWithCounts(formData);
        console.log("Backend response:", response);

        if (response.success) {
          isUploadSuccess = true;
          toast.success(`File uploaded successfully!`);
        } else {
          toast.error("Failed to upload files.");
        }
      }

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
        setIsLoading(false);
        setLoading(false);
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

          toast.success("Your bot is now ready to use!");
        } catch (error) {
          console.error("Error updating bot status:", error);
          toast.error("We couldn't activate your bot. Please try again.");
        }
      }

      setTimeout(() => {
        localStorage.removeItem("youtube_video_urls");
        localStorage.removeItem("selected_videos");
        navigate("/dashboard/upload");
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4  ">
            {/* <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 ">
              Bot Name
            </label> */}
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Bot name"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Knowledge Source Toggle */}
            {/* <div className="pt-6">
              <label
                className="block font-medium mb-2"
                style={{
                  color: "#333333", // dark text color
                  fontFamily: "Instrument Sans, sans-serif",
                  fontSize: "16px",
                  fontWeight: "600",
                }}
              >
                Knowledge Source
              </label>

              <div className="flex items-center">
                <span className="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Only provided knowledge
                </span>
                
               
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={useExternalKnowledge}
                    onChange={() =>
                      setUseExternalKnowledge(!useExternalKnowledge)
                    }
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
                <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Include external knowledge when needed
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {`When enabled, external knowledge helps answer questions beyond your provided content.`}
              </p>
            </div> */}

            {/* Knowledge Source RadioButton in two line  */}
            <div className="pt-6 ">
              <label
                className="block font-medium mb-2"
                style={{
                  color: "#333333",
                  fontFamily: "Instrument Sans, sans-serif",
                  fontSize: "16px",
                  fontWeight: "600",
                }}
              >
                Knowledge Source
              </label>

              <div className="flex flex-col space-y-4">
                {/* First radio - always selected, not clickable */}
                <label className="inline-flex items-center cursor-not-allowed ">
                  <span className="h-4 w-4 mr-2 inline-block rounded-full border-2 border-blue-600 bg-blue-600"
                  style={{ borderColor: "#5348CB", backgroundColor: "#5348CB" }}></span>
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

                {/* Second radio - toggleable */}
                <label
                  className="inline-flex items-center cursor-pointer"
                  onClick={() => setUseExternalKnowledge(!useExternalKnowledge)}
                >
                  <span
                    className={`h-4 w-4 mr-2 inline-block rounded-full border-2 ${
    useExternalKnowledge ? "border-gray-400" : "border-gray-400"
  }`}
  style={
    useExternalKnowledge
      ? { borderColor: "#5348CB", backgroundColor: "#5348CB" }
      : { borderColor: "#9CA3AF" } // Tailwind's gray-400 hex, optional
  }

                  ></span>
                  <span
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
        return <WebScrapingTab />;
      // if (user.subscription_plan_id === 1) {
      //   return <WebScrapingTab />;
      // } else {
      //   return <SubscriptionScrape />;
      // }
      // return (
      //   <div className="space-y-4">
      //     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      //       Website URL
      //     </label>
      //     <div className="mt-1 flex">
      //       <input
      //         type="url"
      //         value={websiteUrl}
      //         onChange={(e) => setWebsiteUrl(e.target.value)}
      //         placeholder="https://your-website.com"
      //         className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
      //       />
      //       <button
      //         onClick={() => fetchNodes(websiteUrl)}
      //         className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
      //       >
      //         Submit
      //       </button>
      //     </div>
      //     {nodes.length < 1 && (
      //       <p className="text-sm text-gray-500">
      //         This will help your chatbot understand your business context
      //         better.
      //       </p>
      //     )}
      //     {nodes.length > 0 && (
      //       <p className="text-sm text-gray-500">
      //         You can select up to <strong>10 pages</strong> for free. Want to
      //         add more?{" "}
      //         <a href="/subscription" className="text-blue-500 underline">
      //           Upgrade your subscription
      //         </a>
      //         .
      //       </p>
      //     )}

      //     {nodes.length > 0 && (
      //       <div className="mt-4">
      //         <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      //           Select Pages to Scrape:
      //         </h4>
      //         <div className="space-y-2">
      //           {getPaginatedNodes().map((node, index) => (
      //             <label key={index} className="flex items-center space-x-2">
      //               <input
      //                 type="checkbox"
      //                 value={node}
      //                 checked={selectedNodes.includes(node)}
      //                 onChange={() => handleCheckboxChange(node)}
      //                 className="h-5 w-5 text-blue-600 border-gray-400 rounded shrink-0"
      //               />
      //               <span className="text-sm text-gray-600 dark:text-gray-400">
      //                 {node}
      //               </span>
      //             </label>
      //           ))}
      //         </div>
      //         <div className="flex justify-center mt-4">
      //           {renderPaginationButtons()}
      //         </div>
      //       </div>
      //     )}
      //   </div>
      // );

      case 2:
        return (
          <div>
            {/* File Dropzone */}
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors relative  "
              style={{ backgroundColor: "#F8FDFF" }}
            >
              <input {...getInputProps()} />
              {isProcessingFiles && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center  ">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2  " />
                  <p className="text-gray-600 ">{processingMessage}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    This may take a moment...
                  </p>
                </div>
              )}
              {/* <Upload className="mx-auto h-12 w-12 text-gray-400" /> */}
              <img
                src="/images/dummy/folder.png"
                alt="Upload Icon"
                className="mx-auto h-12 w-12 object-contain"
              />
              <p className="mt-2 text-sm text-gray-600 ">
                Drag and drop files here, or click to select files
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Maximum {userUsage.planLimit.toLocaleString()} words total,{" "}
                {userPlan?.per_file_size_limit}MB per file ((PDF, TXT, Doc,
                Docx, .png, .jpg, .jpeg, .gif files only))
              </p>
            </div>
            <div className="flex flex-wrap justify-between gap-4 mt-4  ">
              {/* Word Count Summary */}
              <div className="flex-[0_0_48%] p-4 bg-white dark:bg-gray-700 rounded-lg  ">
                <span
                  className="text-gray-700 dark:text-gray-300 "
                  style={{
                    fontFamily: "Instrument Sans, sans-serif",
                    fontSize: "18px",
                    fontWeight: 600,
                  }}
                >
                  Word Usage
                </span>

                {/* Progress Bar - Fixed Calculation */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600 mt-2 mb-2  ">
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

                <div className="flex items-center justify-between mb-1  ">
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

                {/* Warning Messages */}
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

              {/* File Storage Summary */}
              <div className="flex-[0_0_48%] p-4 bg-white dark:bg-gray-700 rounded-lg">
                <span
                  className="text-gray-700 dark:text-gray-300 "
                  style={{
                    fontFamily: "Instrument Sans, sans-serif",
                    fontSize: "18px",
                    fontWeight: 600,
                  }}
                >
                  Storage
                </span>

                {/* Storage Progress Bar */}
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

                {/* Storage Warning Messages */}
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
            <div className="bg-white  mt-4">
              <div className="p-4 ">
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
                            {file.loadingCounts ? (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : file.error ? (
                              <span className="text-xs text-red-500">
                                Error
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {file.charCount?.toLocaleString() || "0"}
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

            {/* YouTube Uploader */}
            <div className="mt-6 relative">
              <h2
                className="mb-2 text-gray-900 dark:text-white"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  fontFamily: "'Instrument Sans', sans-serif",
                }}
              >
                Add YouTube videos
              </h2>
              {/* <p
                className="text-gray-700 dark:text-gray-300"
                style={{
                  fontSize: "14px",
                  fontWeight: 400,
                  color: "#666666",
                  fontFamily: "'Instrument Sans', sans-serif",
                  marginTop: 0,
                }}
              >
                Import videos from YouTube
              </p> */}
              {/* This container holds both the uploader and overlay */}
              <div className="min-h-[100px] mb-10 ">
                <YouTubeUploader maxVideos={5} />
                {/* <p
                  className="mb-2 mt-2"
                  style={{
                    fontSize: "14px",
                    fontWeight: 400,
                    fontFamily: "'Instrument Sans', sans-serif",
                    color: "#666666",
                  }}
                >
                  Enter YouTube video or playlist URL
                </p> */}

                {/* Show upgrade message only for plans 1 and 2 */}
                {[1, 2].includes(user.subscription_plan_id) && (
                  <YouTubeUpgradeMessage requiredPlan="Growth" />
                )}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white py-8  ">
      <ToastContainer />
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
          </div>

          <div className="flex justify-start  gap-x-3 m-2 mt-8 ">
            <button
              onClick={handleBack}
              className="flex items-center px-6 py-2 rounded-lg border hover:bg-blue-50  "
              style={{
                backgroundColor: "#FFFFFF",
                color: "#1D4ED8", // Tailwind's blue-700
                borderColor: "#1D4ED8",
                borderWidth: "1px",
                fontFamily: "Instrument Sans, sans-serif",
                fontSize: "16px",
                fontWeight: 500,
                borderRadius: "12px",
                minWidth: "100px",
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleNext}
              disabled={isLoading}
              className={`flex items-center justify-center px-6 py-2 rounded-lg text-white font-medium min-w-[100px]
    ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
    transition-colors duration-200
  `}
              style={{
                fontFamily: "Instrument Sans, sans-serif",
                fontSize: "16px",
                backgroundColor: botName.trim() ? "#5348CB" : "#AAAAAA",
              }}
              onMouseEnter={(e) => {
                if (botName.trim())
                  e.currentTarget.style.backgroundColor = "#4034B1"; // hover shade
              }}
              onMouseLeave={(e) => {
                if (botName.trim())
                  e.currentTarget.style.backgroundColor = "#5348CB"; // original color
              }}
            >
              {isLoading ? (
                "Processing..."
              ) : currentStep === steps.length - 1 ? (
                "Finish"
              ) : (
                <>Next</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateBot;

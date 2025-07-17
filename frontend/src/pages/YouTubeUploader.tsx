import React, { useState, useEffect, useCallback } from "react";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";

import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";
import { toast } from "react-toastify";

interface YouTubeUploaderProps {
  maxVideos?: number;
  refreshKey?: number; // Add refreshKey prop
  setIsVideoSelected?: React.Dispatch<React.SetStateAction<boolean>>; 
  onChangesMade?: () => void; 
  isReconfiguring?: boolean;
  disableActions?: boolean;  
}

const YouTubeUploader: React.FC<YouTubeUploaderProps> = ({
  maxVideos = 0, // Default to 0
  refreshKey = 0, // Default to 0 (since it's a number)
  setIsVideoSelected = () => {}, 
  onChangesMade,
  isReconfiguring = false, // Default to false
  disableActions = false,
}) => {
  const { selectedBot } = useBot(); // Use BotContext
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const { loading, setLoading } = useLoader();
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { setLoading: setGlobalLoading } = useLoader();
  const [refreshKeyState, setRefreshKeyState] = useState<number>(0);
  const [scrapeSuccess, setScrapeSuccess] = useState(false);


  useEffect(() => {
  const handleReset = () => {
    setVideoUrls([]);
    setSelectedVideos([]);
    setYoutubeUrl("");
  };

  window.addEventListener("resetYouTubeUploader", handleReset);

  return () => {
    window.removeEventListener("resetYouTubeUploader", handleReset);
  };
}, []);

  // ✅ Reload video URLs when refreshKey changes
  useEffect(() => {
    setSelectedVideos([]);
    const savedVideoUrls = localStorage.getItem("youtube_video_urls");
    console.log("savedVideoUrls", savedVideoUrls);
    if (savedVideoUrls) {
      try {
        const parsedUrls = JSON.parse(savedVideoUrls);
        if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
          setVideoUrls(parsedUrls);
        } else {
          setVideoUrls([]); // ✅ Clear if empty or invalid
        }
      } catch (error) {
        console.error("Error parsing stored video URLs:", error);
      }
    }
  }, [refreshKey]); // <-- Refresh when refreshKey updates


  // Load selected videos from localStorage when component mounts
  useEffect(() => {
    const savedSelectedVideos = localStorage.getItem("selected_videos");
    console.log("savedSelectedVideos", savedSelectedVideos);
    if (savedSelectedVideos) {
      try {
        const parsedSelectedVideos = JSON.parse(savedSelectedVideos);
        if (
          Array.isArray(parsedSelectedVideos) &&
          parsedSelectedVideos.length > 0
        ) {
          setSelectedVideos(parsedSelectedVideos);
        }
      } catch (error) {
        console.error("Error parsing stored selected videos:", error);
      }
    }
  }, []);

  // Store video URLs in localStorage
  useEffect(() => {
    if (videoUrls.length > 0) {
      console.log("videoUrls", videoUrls);
      localStorage.setItem("youtube_video_urls", JSON.stringify(videoUrls));
    }
  }, [videoUrls]);

  // Store selected videos in localStorage
  useEffect(() => {
    if (selectedVideos.length > 0) {
      localStorage.setItem("selected_videos", JSON.stringify(selectedVideos));
    }
  }, [selectedVideos]);

  const handleFetchVideos = async () => {
    if (!youtubeUrl) return;

    // Only check isReconfiguring if disableActions is false
    if (!disableActions && !isReconfiguring) {
      toast.error("Please click Reconfigure first before adding YouTube videos");
      return;
    }

    try {
      console.log("selectedBot?.id", selectedBot?.id);
      setLoading(true);
      setError(null); // Clear previous errors
      console.log(youtubeUrl);
      setVideoUrls([]);
      setSelectedVideos([]);
      const response = await authApi.fetchVideosFromYouTube(youtubeUrl);
      if (response?.video_urls) {
        const updatedUrls = Array.from(
          new Set([...response.video_urls])
        ); // Avoid duplicates
        setVideoUrls(updatedUrls);
        //setVideoUrls(updatedUrls);

        setYoutubeUrl(""); // Clear input field after successful fetch
      } else {
        console.error("Invalid response format:", response);
        setError(
          "No videos found. Ensure the link is a valid YouTube video or playlist."
        );
      }
    } catch (error: any) {
      console.error("Error fetching videos:", error);

      if (error.response?.status === 400) {
        // Check for specific YouTube bot protection error
        const errorDetail = error.response?.data?.detail || "";
        
        if (errorDetail.includes("bot protection") || errorDetail.includes("Sign in to confirm")) {
          setError(
            "YouTube bot protection triggered. Please use a direct video URL instead of a playlist."
          );
        } else if (errorDetail.includes("playlist")) {
          setError(
            "Could not process the YouTube playlist. Please try using individual video URLs instead."
          );
        } else {
          setError(
            "Invalid YouTube URL. Please enter a valid YouTube video or playlist URL."
          );
        }
      } else if (error.response?.status === 404) {
        setError("No videos found in the provided link.");
      } else {
        setError("An error occurred while fetching videos. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = (videoUrl: string) => {
    
     if (!disableActions && !isReconfiguring) {
      toast.error("Please click Reconfigure first before selecting videos");
      return;
    }

    if (selectedVideos.includes(videoUrl)) {
      const newSelectedVideos = selectedVideos.filter((url) => url !== videoUrl);
      setSelectedVideos(selectedVideos.filter((url) => url !== videoUrl));
      setIsVideoSelected(newSelectedVideos.length > 0);
    } else {
      const newSelectedVideos = [...selectedVideos, videoUrl];
      setSelectedVideos([...selectedVideos, videoUrl]);
      setIsVideoSelected(true);
    }
    if (onChangesMade) onChangesMade(); 
  };

  const handleVideoSelection = (videos: any[]) => {
    setIsVideoSelected(videos.length > 0);
    if (onChangesMade) onChangesMade(); // Call the callback
  };
  
  const handleScrape = async () => {
    if (selectedVideos.length === 0) {
      toast.error("Please select at least one video to process.");
      return;
    }

    setGlobalLoading(true);
    try {
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }
      const data = await authApi.scrapeYoutubeVideos(selectedVideos, selectedBot?.id);
      console.log("YouTube scraping result:", data);

      // Check if the message indicates processing has started (accept any message that indicates success)
      if (data && data.message && (
          data.message.includes("processing started") || 
          data.message.includes("Video processing") ||
          data.message.includes("YouTube content")
        )) {
        toast.success("Your YouTube videos are being processed. We'll notify you when they're ready.");
        setScrapeSuccess(true);
        setRefreshKeyState(prev => prev + 1); // Trigger a refresh
        setSelectedVideos([]);
        setVideoUrls([]);
        setYoutubeUrl("");
        if (selectedBot?.status === "In Progress") {
          await authApi.updateBotStatusActive(selectedBot.id, {
            status: "Active",
            is_active: true,
          });
        }
      } else {
        console.error("Unexpected API response:", data);
        toast.error("Failed to process YouTube videos. Please try again.");
      }
    } catch (error) {
      console.error("Error processing YouTube videos:", error);
      toast.error("We couldn't process your YouTube videos. Please try again.");
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    setIsVideoSelected(selectedVideos.length > 0);
  }, [selectedVideos]);

  // Pagination logic
  const getPaginatedVideos = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return videoUrls.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(videoUrls.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderButton = (pageNumber: number) => (
  <button
    key={pageNumber}
    onClick={() => handlePageChange(pageNumber)}
    className={`px-4 py-2 mx-1 rounded-md ${
      currentPage === pageNumber
        ? "bg-blue-500 text-white"
        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`}
  >
    {pageNumber}
  </button>
);

const renderPaginationButtons = () => {
  const buttons = [];
  const maxPagesToShow = 5;

  if (totalPages <= maxPagesToShow + 2) {
    // Show all pages if count is small
    for (let i = 1; i <= totalPages; i++) {
      buttons.push(renderButton(i));
    }
  } else {
    // Always show first page
    buttons.push(renderButton(1));

    // Show starting ellipsis
    if (currentPage > 3) {
      buttons.push(
        <span key="start-ellipsis" className="px-2 text-gray-500">
          ...
        </span>
      );
    }

    // Middle page buttons
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(renderButton(i));
    }

    // Show ending ellipsis
    if (currentPage < totalPages - 2) {
      buttons.push(
        <span key="end-ellipsis" className="px-2 text-gray-500">
          ...
        </span>
      );
    }

    // Always show last page
    buttons.push(renderButton(totalPages));
  }

  return buttons;
};

  return (
    <div className="space-y-4  ">
            {/* <h1
  style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "20px",
              color: "#333333",
              fontWeight: "bold",
              marginBottom: "20px",
            }}
>  YouTube Videos
</h1> */}

  <h1 className="mt-1"
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    color: "#666666",
    fontWeight: 400,
    marginBottom: "20px",
    
    
  }}
>  Import videos from YouTube
</h1>

      <div className="flex items-center space-x-2 w-4/5 ">
        <input
          type="text"
          placeholder="YouTube URL"
          value={youtubeUrl}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />

        <button
          onClick={handleFetchVideos}
          className="ml-2 flex items-center justify-center disabled:opacity-80 disabled:cursor-not-allowed"
  style={{
    backgroundColor: youtubeUrl.trim() ? "#5348CB" : "#AAAAAA",
    fontFamily: 'Instrument Sans, sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    color: 'white',
    minWidth: '102px',
    width: '140px',
    height: '40px', 
    textAlign: 'center',
    borderRadius: '0.375rem', // same as rounded-md
  }}
          disabled={loading} // Disable button when loading
        >
          {loading ? "Processing..." : "Add"}
        </button>
      </div>

      <h1 
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    color: "#666666",
    fontWeight: 400,
    marginBottom: "20px",
    
    
  }}
>  Enter YouTube video or playlist URL
</h1>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {videoUrls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedVideos([...videoUrls])}
                      className="px-3 py-1 bg-[#5348CB] text-white text-sm rounded hover:bg-[#433aa8]"
                    >
                      Select All ({videoUrls.length})
                    </button>
                    <button
                      onClick={() => setSelectedVideos([])}
                      className="px-3 py-1 bg-gray-300 text-sm rounded hover:bg-gray-400"
                    >
                      Clear All
                    </button>
                </div>
                <div className="text-sm text-gray-700">
                  Selected: {selectedVideos.length}
                </div>
          <h3 className="text-md font-semibold text-black">
            Select Videos to Process
          </h3>
          <div className="max-h-90 overflow-y-auto border p-2 rounded-md">
            {getPaginatedVideos().map((videoUrl, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedVideos.includes(videoUrl)}
                  onChange={() => handleSelectVideo(videoUrl)}
                />
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {videoUrl}
                </a>
              </div>
            ))}
          </div>
          {/* Pagination buttons */}
          <div className="flex justify-center mt-4">
            {renderPaginationButtons()}
          </div>
          {/* Show Loader when loading is true */}
          {loading && <Loader />}


          
        </div>
      )}
    </div>
  );
};

export default YouTubeUploader;
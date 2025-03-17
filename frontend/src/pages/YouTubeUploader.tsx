import React, { useState, useEffect } from "react";
//import { Button } from "@/components/ui/button";
//import { Input } from "@/components/ui/input";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
import { toast } from "react-toastify";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";
interface YouTubeUploaderProps {
  maxVideos: number;
  refreshKey: number; // Add refreshKey prop
}

const YouTubeUploader: React.FC<YouTubeUploaderProps> = ({
  maxVideos,
  refreshKey,
}) => {
  const { selectedBot, setSelectedBot } = useBot(); // Use BotContext
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const { loading, setLoading } = useLoader();
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ✅ Reload video URLs when refreshKey changes
  useEffect(() => {
    const savedVideoUrls = localStorage.getItem("youtube_video_urls");
    console.log("savedVideoUrls", savedVideoUrls);
    if (savedVideoUrls) {
      try {
        const parsedUrls = JSON.parse(savedVideoUrls);
        if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
          setVideoUrls(parsedUrls);
        }
      } catch (error) {
        console.error("Error parsing stored video URLs:", error);
      }
    }
  }, [refreshKey]); // <-- Refresh when refreshKey updates

  /// Load video URLs from localStorage when component mounts
  useEffect(() => {
    const savedVideoUrls = localStorage.getItem("youtube_video_urls");
    console.log("savedVideoUrls", savedVideoUrls);
    if (savedVideoUrls) {
      try {
        const parsedUrls = JSON.parse(savedVideoUrls);
        if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
          setVideoUrls(parsedUrls);
        }
      } catch (error) {
        console.error("Error parsing stored video URLs:", error);
      }
    }
  }, []);

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
    try {
      console.log("selectedBot?.id", selectedBot?.id);
      setLoading(true);
      setError(null); // Clear previous errors
      const response = await authApi.fetchVideosFromPlaylist(youtubeUrl);
      if (response?.video_urls) {
        const updatedUrls = Array.from(
          new Set([...videoUrls, ...response.video_urls])
        ); // Avoid duplicates
        setVideoUrls(updatedUrls);
        //setVideoUrls(updatedUrls);

        setYoutubeUrl(""); // Clear input field after successful fetch
      } else {
        console.error("Invalid response format:", response);
        setError(
          "No videos found. Ensure the link is a valid playlist or video."
        );
      }
    } catch (error: any) {
      console.error("Error fetching videos:", error);

      if (error.response?.status === 400) {
        setError(
          "Invalid YouTube URL. Please enter a valid video or playlist URL."
        );
      } else if (error.response?.status === 404) {
        setError("No videos found in the provided link.");
      } else {
        setError("An error occurred while fetching videos. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  //   const handleSelectVideo = (videoId: string) => {
  //     setSelectedVideos((prev) =>
  //       prev.includes(videoId)
  //         ? prev.filter((id) => id !== videoId)
  //         : [...prev, videoId]
  //     );
  //   };
  const handleSelectVideo = (videoId: string) => {
    setSelectedVideos((prev) => {
      if (prev.includes(videoId)) {
        // If already selected, remove from the list
        return prev.filter((id) => id !== videoId);
      } else {
        if (prev.length >= maxVideos) {
          toast.error(`You can only select ${maxVideos} videos.`);
          return prev; // Do not add more than 5
        }
        return [...prev, videoId];
      }
    });
  };

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

  const renderPaginationButtons = () => {
    const buttons = [];
    for (let i = 1; i <= totalPages; i++) {
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

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Import Videos from YouTube</h2>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Enter YouTube video or playlist URL"
          value={youtubeUrl}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          onChange={(e) => setYoutubeUrl(e.target.value)}
        />

        <button
          onClick={handleFetchVideos}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          disabled={loading} // Disable button when loading
        >
          {loading ? "Processing..." : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {videoUrls.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Select Videos to Process</h3>
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
          {/* <button
          <button
            onClick={handleProcessVideos}
            className={`ml-2 px-4 py-2 text-white rounded-md ${
              selectedVideos.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
            disabled={selectedVideos.length === 0}
          >
            Process Selected Videos
          </button> */}
          {/* Show Loader when loading is true */}
          {loading && <Loader />}
        </div>
      )}
    </div>
  );
};

export default YouTubeUploader;

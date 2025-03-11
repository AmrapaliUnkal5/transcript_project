import React, { useState, useEffect } from "react";
//import { Button } from "@/components/ui/button";
//import { Input } from "@/components/ui/input";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
import { toast } from "react-toastify";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";

const YouTubeUploader: React.FC = () => {
  const { selectedBot } = useBot();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const { loading, setLoading } = useLoader();
  const [error, setError] = useState<string | null>(null);

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
        //setVideoUrls(response.video_urls); // Fix: Correctly updating state
        // setVideoUrls((prevUrls) => [...prevUrls, ...response.video_urls]);
        //const updatedUrls = Array.from(
        //  new Set([...videoUrls, ...response.video_urls])
        //); // Avoid duplicates
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
        if (prev.length >= 5) {
          toast.error("Free plan allows only 5 videos to be uploaded.");
          return prev; // Do not add more than 5
        }
        return [...prev, videoId];
      }
    });
  };

  const handleProcessVideos = async () => {
    if (!selectedBot?.id) {
      console.error("Bot ID is missing.");
      return;
    }
    try {
      setLoading(true);
      await authApi.storeSelectedYouTubeTranscripts(
        selectedVideos,
        selectedBot.id
      );
      //alert("Videos processed and stored successfully!");
      toast.success("Videos processed and stored successfully!");
      // Keep only the unchecked videos in the list
      //setVideoUrls((prev) =>
      //  prev.filter((videoUrl) => !selectedVideos.includes(videoUrl))
      //);
      // Update localStorage to reflect the new state
      //localStorage.setItem(
      //  "youtube_video_urls",
      //  JSON.stringify(
      //    videoUrls.filter((videoUrl) => !selectedVideos.includes(videoUrl))
      // )
      //);
      //localStorage.removeItem("selected_videos"); // Since none are selected anymore
      //setVideoUrls([]);
      //setSelectedVideos([]);
      localStorage.setItem("selected_videos", JSON.stringify(selectedVideos));
    } catch (error) {
      console.error("Error processing videos:", error);
    } finally {
      setLoading(false); // Hide loader after API call
    }
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
          <div className="max-h-60 overflow-y-auto border p-2 rounded-md">
            {videoUrls.map((videoUrl, index) => (
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
          </button>
          {/* Show Loader when loading is true */}
          {loading && <Loader />}
        </div>
      )}
    </div>
  );
};

export default YouTubeUploader;

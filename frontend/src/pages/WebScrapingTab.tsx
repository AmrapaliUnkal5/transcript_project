import React, { useState, useEffect } from "react";
//import { Button } from "@/components/ui/button";
//import { Input } from "@/components/ui/input";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
//import { toast } from "react-toastify";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook

import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";

const WebScrapingTab: React.FC = () => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const { loading, setLoading } = useLoader();
  //const { selectedBot, setSelectedBot } = useBot(); // Use BotContext
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { selectedBot } = useBot(); // Use BotContext
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<string | null>(null);
  const [scrapedWebsiteUrl, setScrapedWebsiteUrl] = useState<string | null>(
    null
  );

  const [scrapedUrls, setScrapedUrls] = useState<
    { id: number; url: string; title: string }[]
  >([]);

  // ✅ Move fetchScrapedUrls outside of useEffect so it can be reused
  const fetchScrapedUrls = async () => {
    try {
      setLoading(true);
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }

      const response = await authApi.getScrapedUrls(selectedBot?.id);
      console.log("Response Data:", response);

      if (Array.isArray(response)) {
        const formattedUrls = response.map((item, index) => ({
          id: index + 1,
          url: item.url,
          title: item.title || "No Title",
        }));

        console.log("Formatted URLs:", formattedUrls);
        setScrapedUrls(formattedUrls); // ✅ Update state correctly
        // Set the first scraped website URL
        if (formattedUrls.length > 0) {
          setScrapedWebsiteUrl(new URL(formattedUrls[0].url).origin);
          console.log("scrapedWebsiteUrl", scrapedWebsiteUrl);
        }
      } else {
        setScrapedUrls([]); // ✅ Ensure it's always an array
      }
    } catch (error) {
      toast.error("Failed to load scraped URLs");
      console.error("Failed to fetch scraped URLs:", error);
      setScrapedUrls([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Call fetchScrapedUrls only when selectedBot changes
  useEffect(() => {
    fetchScrapedUrls();
  }, [selectedBot?.id]);

  // Handle delete confirmation
  const handleDeleteClick = (url: string) => {
    setUrlToDelete(url); // Set URL to delete
    setIsModalOpen(true); // Open modal
  };

  // Handle actual delete
  const confirmDelete = async () => {
    if (!urlToDelete || !selectedBot?.id) return;

    try {
      setLoading(true);
      await authApi.deleteScrapedUrl(selectedBot.id, urlToDelete);
      toast.success("URL deleted successfully!");
      fetchScrapedUrls(); // Refresh list
      setScrapedWebsiteUrl(null);
    } catch (error) {
      toast.error("Failed to delete URL.");
      console.error("Delete Error:", error);
    } finally {
      setLoading(false);
      setIsModalOpen(false); // Close modal
      setUrlToDelete(null);
    }
  };

  const handleFetchNodes = async () => {
    if (!websiteUrl) return;

    // Restrict changing the website once scraping has started
    if (scrapedWebsiteUrl && new URL(websiteUrl).origin !== scrapedWebsiteUrl) {
      toast.error(
        "You can only scrape from the same website. Delete existing data to scrape a different site."
      );
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.getWebsiteNodes(websiteUrl);
      console.log("Fetched Nodes Response:", response); // Debugging log

      if (response && Array.isArray(response.nodes)) {
        setNodes(response.nodes); // Correctly setting the extracted array
      } else {
        console.error(
          "API response does not contain a valid nodes array:",
          response
        );
      }
    } catch (error) {
      console.error("Error fetching nodes:", error);
    }
    setLoading(false);
  };

  const handleScrape = async () => {
    if (selectedNodes.length === 0) {
      toast.error("Please select at least one page to scrape.");
      return;
    }

    setLoading(true);
    try {
      console.log("selectedBot?.id", selectedBot?.id);
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }
      const data = await authApi.scrapeNodes(selectedNodes, selectedBot?.id);
      console.log("Scraping result:", data);

      if (data.message === "Scraping completed") {
        toast.success("Scraping successful!");
        setScrapedWebsiteUrl(new URL(websiteUrl).origin);
        // if (!scrapedWebsiteUrl) {
        //   setScrapedWebsiteUrl(new URL(websiteUrl).origin);
        // }
        setCurrentPage(1); // Reset pagination
        setSelectedNodes([]); // Clear selection
        fetchScrapedUrls();
        if (selectedBot?.status === "In Progress") {
          await authApi.updateBotStatusActive(selectedBot.id, {
            status: "Active",
            is_active: true,
          });
        }
      } else {
        toast.error("Failed to scrape data. Please try again.");
      }
    } catch (error) {
      console.error("Error scraping website:", error);
      toast.error("An error occurred while scraping. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxPagesToShow = 5; // Number of page buttons before adding '...'

    if (totalPages <= maxPagesToShow + 2) {
      // If total pages are small, show all buttons
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(renderButton(i));
      }
    } else {
      // Always show first and last page
      buttons.push(renderButton(1));

      if (currentPage > 3) {
        buttons.push(<span key="start-dots">...</span>);
      }

      // Show up to 3 pages around the current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        buttons.push(renderButton(i));
      }

      if (currentPage < totalPages - 2) {
        buttons.push(<span key="end-dots">...</span>);
      }

      buttons.push(renderButton(totalPages));
    }

    return buttons;
  };

  const renderButton = (page: number) => (
    <button
      key={page}
      onClick={() => handlePageChange(page)}
      className={`px-4 py-2 mx-1 rounded-md ${
        currentPage === page
          ? "bg-blue-500 text-white"
          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
      }`}
    >
      {page}
    </button>
  );
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const getPaginatedNodes = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return nodes.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(nodes.length / itemsPerPage);

  const handleCheckboxChange = (url: string) => {
    if (selectedNodes.includes(url)) {
      setSelectedNodes((prev) => prev.filter((node) => node !== url));
    } else {
      if (selectedNodes.length >= 10) {
        // toast.error(
        //   "You are on the Free Tier! Upgrade your subscription to select more pages."
        // );
        // return;
      }
      setSelectedNodes((prev) => [...prev, url]);
    }
  };

  return (
    <div className="space-y-6">
      {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Website
      </h1> */}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2">
          {" "}
          {/* Added flex and spacing */}
          <input
            type="text"
            placeholder="Enter website URL"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleFetchNodes}
            className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Submit
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 italic">
          On the free plan, you can scrape only one website.{" "}
          <a href="/subscription" className="text-blue-500 underline">
            Upgrade
          </a>{" "}
          to unlock unlimited scraping!
        </p>
      </div>

      {/* {nodes.length < 1 && (
        <p className="text-sm text-gray-500">
          This will help your chatbot understand your business context better.
        </p>
      )}
      {nodes.length > 0 && (
        <p className="text-sm text-gray-500">
          You can select up to <strong>10 pages</strong> for free. Want to add
          more?{" "}
          <a href="/subscription" className="text-blue-500 underline">
            Upgrade your subscription
          </a>
          .
        </p>
      )} */}

      {nodes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Pages to Scrape:
          </h4>
          <div className="space-y-2">
            {getPaginatedNodes().map((node, index) => (
              <label key={index} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={node}
                  checked={selectedNodes.includes(node)}
                  onChange={() => handleCheckboxChange(node)}
                  className="h-5 w-5 text-blue-600 border-gray-400 rounded shrink-0"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {node}
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-center mt-4">
            {renderPaginationButtons()}
          </div>
        </div>
      )}
      {/* Scrape Button (Visible Only When Checkboxes Are Displayed) */}
      {selectedNodes.length > 0 && (
        <div className="flex justify-start mt-6">
          <button
            onClick={handleScrape}
            className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Scrape Selected Pages
          </button>
        </div>
      )}
      {loading ? (
        <p className="text-center text-gray-600">Loading...</p>
      ) : scrapedUrls.length === 0 ? (
        <p className="text-center text-gray-500"></p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Scraped Website URLs
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    S.No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {scrapedUrls.map((item, index) => (
                  <tr
                    key={item.id}
                    className="text-gray-700 dark:text-gray-300"
                  >
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {index + 1}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-gray-900 dark:text-gray-200">
                      {item.title || "No Title"}{" "}
                      {/* ✅ Display Title with Fallback */}
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        {item.url}
                      </a>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteClick(item.url)}
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
      )}
      {/* Delete Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">
              Are you sure you want to delete this URL?
            </p>
            <p className="text-sm text-gray-500">{urlToDelete}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded-md mr-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebScrapingTab;

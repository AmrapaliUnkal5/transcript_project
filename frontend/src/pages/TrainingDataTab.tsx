import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { authApi } from "../services/api";

interface TrainingDataTabProps {
  botId: number | null;
  onTrain: () => void;
  onCancel: () => void;
  isLoading: boolean;
  
}

interface TrainingData {
  files: {file_name: string}[];
  scraped_content: {url: string, title: string}[];
  youtube_videos: {video_title: string, video_url: string}[];
}

export const TrainingDataTab = ({ botId, onTrain, isLoading, onCancel  }: TrainingDataTabProps) => {
  const [dataToTrain, setDataToTrain] = useState<TrainingData | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const loadTrainingData = async () => {
      if (!botId) return;
      
      setLoadingData(true);
      try {
        const response = await authApi.getBotProgressData(botId);
        setDataToTrain(response);
      } catch (error) {
        console.error("Error fetching training data:", error);
        toast.error("Failed to load training content");
      } finally {
        setLoadingData(false);
      }
    };

    loadTrainingData();
  }, [botId]);

     return (
      <div className="space-y-6">
           
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Training Content Summary
            </h3>
          </div>
          
          {loadingData  ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : dataToTrain ? (
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Files */}
                  {dataToTrain.files.map((file, index) => (
                    <tr key={`file-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          File
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {file.file_name}
                      </td>
                      </tr>
                  ))}

                  {/* Scraped content */}
                  {dataToTrain.scraped_content.map((node, index) => (
                    <tr key={`node-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Web Page
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a href={node.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title={node.url} >
                          Link
                        </a>
                      </td>
                      </tr>
                  ))}

                  {/* YouTube videos */}
                  {dataToTrain.youtube_videos.map((video, index) => (
                    <tr key={`video-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-yellow-800">
                          Video
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800" title={video.video_url}>
                          Link
                        </a>
                      </td>
                      </tr>
                  ))}

                  {dataToTrain.files.length === 0 && 
                   dataToTrain.scraped_content.length === 0 && 
                   dataToTrain.youtube_videos.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                        No training content found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">
              Failed to load training data
            </div>
          )}
        </div>

        {/* Train Your Bot button at the bottom */}
      <div className="flex justify-center">
        <button
          onClick={onTrain}
          disabled={isLoading}
          className={`px-6 py-3 rounded-lg text-white font-medium ${
            isLoading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
          } transition-colors duration-200`}
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
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Upload, MessageSquare, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { authApi } from "../services/api";

interface Step {
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const steps: Step[] = [
  {
    title: 'Name Your Bot',
    description: 'Give your chatbot a unique and identifiable name.',
    icon: MessageSquare,
  },
  {
    title: 'Website Information',
    description: 'Add your website URL to help your chatbot understand your domain.',
    icon: Globe,
  },
  {
    title: 'Knowledge Base',
    description: 'Upload documents that will serve as the knowledge base for your chatbot.',
    icon: Upload,
  },
];

export const CreateBot = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [botName, setBotName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes] = useState<string[]>([]); // Store website nodes
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]); // Store selected nodes

  const fetchNodes = async (websiteUrl: string) => {
    if (!websiteUrl) {
      alert("Please enter a website URL.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await authApi.getWebsiteNodes(websiteUrl);
      if (data.nodes) {
        setNodes(data.nodes);
        setSelectedNodes([]); // Reset selected nodes when fetching new nodes
      } else {
        setNodes([]);
        alert("No nodes found for this website.");
      }
    } catch (error) {
      console.error("Error fetching website nodes:", error);
      alert("Failed to fetch website nodes. Please try again.");
    }finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (url: string) => {
    if (selectedNodes.includes(url)) {
      // If the node is already selected, allow unchecking
      setSelectedNodes((prev) => prev.filter((node) => node !== url));
    } else {
      if (selectedNodes.length >= 10) {
        alert("🚀 You are on the Free Tier! Upgrade your subscription to select more pages.");
        return; // Stop further selections
      }
      setSelectedNodes((prev) => [...prev, url]);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles]);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const handleNext = async () => {
    if (currentStep === 0) {
      if (selectedNodes.length === 0) {
        alert("⚠️ Please select at least one page to scrape.");
        return;
      }
  
      setIsLoading(true); // Show loading state
  
      try {
        const data = await authApi.scrapeNodes(selectedNodes);
        console.log("Scraping result:", data);
  
        if (data.message === "Scraping completed") {
          setCurrentStep(currentStep + 1); // Move to next step after success
        } else {
          alert("❌ Failed to scrape data. Please try again.");
        }
      } catch (error) {
        console.error("Error scraping website:", error);
        alert("❌ An error occurred while scraping. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setCurrentStep(currentStep + 1);
    }
  };
  
  

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      navigate('/chatbot');
    } catch (error) {
      console.error('Error creating bot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitWebsite = () => {
    console.log('Website submitted:', websiteUrl);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bot Name</label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g., Support Assistant"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Website URL
            </label>
            <div className="mt-1 flex">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => fetchNodes(websiteUrl)}
                className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
            <p className="text-sm text-gray-500">
              You can select up to <strong>10 pages</strong> for free.  
              Want to add more? <a href="/pricing" className="text-blue-500 underline">Upgrade your subscription</a>.
            </p>
      
            {nodes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Pages to Scrape:
                </h4>
                <div className="space-y-2">
                  {nodes.map((node, index) => (
                    <label key={index} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        value={node}
                        checked={selectedNodes.includes(node)}
                        onChange={() => handleCheckboxChange(node)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{node}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">Drag and drop files here, or click to select files</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.title} className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${index <= currentStep ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                <step.icon className="w-6 h-6" />
              </div>
              <p className={`mt-2 text-xs font-medium ${index <= currentStep ? 'text-gray-900' : 'text-gray-500'}`}>{step.title}</p>
            </div>
          ))}
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{steps[currentStep].title}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{steps[currentStep].description}</p>
          {renderStepContent()}
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center px-4 py-2 rounded-lg ${currentStep === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </button>
          <button
            onClick={handleNext}
            disabled={isLoading}
            className={`flex items-center px-6 py-2 ${
              isLoading ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
            } text-white rounded-lg`}
          >
            {isLoading ? 'Processing...' : currentStep === steps.length - 1 ? 'Finish' : <><ArrowRight className="w-5 h-5 ml-2" /> Next</>}
          </button>
        </div>
      </div>
    </div>
  );
};
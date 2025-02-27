import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Upload, MessageSquare, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Website URL</label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleSubmitWebsite}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
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
            className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {isLoading ? 'Processing...' : currentStep === steps.length - 1 ? 'Finish' : <><ArrowRight className="w-5 h-5 ml-2" /> Next</>}
          </button>
        </div>
      </div>
    </div>
  );
};
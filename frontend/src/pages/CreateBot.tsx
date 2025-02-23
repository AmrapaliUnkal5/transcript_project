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
    title: 'Website Information',
    description: 'Add your website URL to help your chatbot understand your domain',
    icon: Globe,
  },
  {
    title: 'Knowledge Base',
    description: 'Upload documents that will serve as the knowledge base for your chatbot',
    icon: Upload,
  },
  {
    title: 'Customize Bot',
    description: "Personalize your chatbot's appearance and behavior",
    icon: MessageSquare,
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
      // Here you would typically:
      // 1. Upload files to your backend
      // 2. Create bot configuration
      // 3. Process the knowledge base
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulated API call
      navigate('/chatbot');
    } catch (error) {
      console.error('Error creating bot:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Website URL
            </label>
            <div className="mt-1">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-sm text-gray-500">
              This will help your chatbot understand your business context better.
            </p>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Drag and drop files here, or click to select files
              </p>
              <p className="text-xs text-gray-500">
                Supported formats: PDF, TXT, DOC, DOCX
              </p>
            </div>
            {files.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Uploaded Files:
                </h4>
                <ul className="space-y-2">
                  {files.map((file, index) => (
                    <li
                      key={index}
                      className="text-sm text-gray-600 dark:text-gray-400 flex items-center"
                    >
                      <Check className="w-4 h-4 text-green-500 mr-2" />
                      {file.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bot Name
            </label>
            <div className="mt-1">
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="e.g., Support Assistant"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-sm text-gray-500">
              This name will be displayed to your users when they interact with the chatbot.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.title}>
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      index <= currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div className="ml-3">
                    <p
                      className={`text-sm font-medium ${
                        index <= currentStep
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {steps[currentStep].title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {steps[currentStep].description}
          </p>
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center px-4 py-2 rounded-lg ${
              currentStep === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={isLoading}
            className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isLoading ? (
              'Processing...'
            ) : currentStep === steps.length - 1 ? (
              'Finish'
            ) : (
              <>
                Next
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
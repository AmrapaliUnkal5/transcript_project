import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Trash2, Eye } from 'lucide-react';
import type { FileUploadInterface } from '../types';
import { authApi } from "../services/api";
import { ApiFile } from '../types'; // Import the ApiFile type
import { useBot } from "../context/BotContext"; // Replace useAuth with useBot
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const FileUpload = () => {
  const { selectedBot } = useBot(); // Use BotContext instead of AuthContext
  const [files, setFiles] = useState<FileUploadInterface[]>([]);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

  // Fetch files when the component mounts
  useEffect(() => {
    const fetchFiles = async () => {
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }
      try {
        const fetchedFiles: ApiFile[] = await authApi.getFiles(selectedBot.id); // Use selectedBot.id
        const formattedFiles = fetchedFiles.map((file) => ({
          id: file.file_id.toString(),
          name: file.file_name,
          type: file.file_type,
          size: parseInt(file.file_size), 
          uploadDate: new Date(file.upload_date), 
          url: file.file_path, 
        }));
        setFiles(formattedFiles);
      } catch (error) {
        console.error('Failed to fetch files:', error);
      }
    };

    fetchFiles();
  }, [selectedBot?.id]); // Use selectedBot.id as a dependency

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const newFilesSize = acceptedFiles.reduce((acc, file) => acc + file.size, 0);

    // Check if any individual file exceeds the maximum file size
    const oversizedFile = acceptedFiles.find(file => file.size > MAX_FILE_SIZE);
    if (oversizedFile) {
      toast.error(`File exceeds the maximum file size of ${formatFileSize(MAX_FILE_SIZE)}.`);
      return;
    }

    // Check if the total size exceeds the maximum total size
    if (totalSize + newFilesSize > MAX_TOTAL_SIZE) {
      toast.error(`Total file size exceeds the maximum limit of ${formatFileSize(MAX_TOTAL_SIZE)}.`);
      return;
    }

    const newFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      uploadDate: new Date(),
      url: URL.createObjectURL(file),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    toast.success("Files uploaded successfully");
  }, [files, MAX_FILE_SIZE, MAX_TOTAL_SIZE]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'text/csv': ['.csv'],
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  return (
    <div className="space-y-6">
      <ToastContainer />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        File Upload
      </h1>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400">
          {isDragActive
            ? 'Drop the files here...'
            : 'Drag & drop files here, or click to select files'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Supported files: PDF, DOC, DOCX, XLS, XLSX, Images
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <File className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {file.type ? (file.type.includes('/') ? file.type.split('/')[1].toUpperCase() : file.type.toUpperCase()) : 'UNKNOWN'}
                    </span>
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
                      onClick={() => window.open(file.url)}
                      className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-4"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
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
    </div>
  );
};
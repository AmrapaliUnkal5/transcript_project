import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Trash2, Eye } from 'lucide-react';
import type { FileUploadInterface } from '../types';
import { authApi } from "../services/api";
import { ApiFile } from '../types';
import { useBot } from "../context/BotContext";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const FileUpload = () => {
  const { selectedBot } = useBot();
  const [existingFiles, setExistingFiles] = useState<FileUploadInterface[]>([]); // Files from the database
  const [newFiles, setNewFiles] = useState<FileUploadInterface[]>([]); // Files added by the user but not yet saved
  const [totalSize, setTotalSize] = useState<number>(0); // Track total size of all files
  const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB

  // Fetch files when the component mounts or when selectedBot changes
  const fetchFiles = async () => {
    if (!selectedBot?.id) {
      console.error("Bot ID is missing.");
      return;
    }
    try {
      const fetchedFiles: ApiFile[] = await authApi.getFiles(selectedBot.id);
      const formattedFiles = fetchedFiles.map((file) => {
        const fileSizeBytes = parseFileSizeToBytes(file.file_size);
        return {
          id: file.file_id.toString(),
          name: file.file_name,
          type: file.file_type,
          size: fileSizeBytes, // Use the size in bytes for calculations
          displaySize: file.file_size, // Keep the human-readable format for display
          uploadDate: new Date(file.upload_date),
          url: file.file_path,
        };
      });

      // Calculate the total size of existing files in bytes
      const existingFilesSize = formattedFiles.reduce((acc, file) => acc + file.size, 0);
      setTotalSize(existingFilesSize);
      setExistingFiles(formattedFiles);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [selectedBot?.id]);

  // Convert human-readable size (e.g., "8.00 MB") to bytes
  const parseFileSizeToBytes = (size: string): number => {
    const sizeRegex = /^(\d+(\.\d+)?)\s*(B|KB|MB|GB)$/i;
    const match = size.match(sizeRegex);

    if (!match) {
      console.error("Invalid file size format:", size);
      return 0; // Default to 0 if the format is invalid
    }

    const value = parseFloat(match[1]);
    const unit = match[3].toUpperCase();

    switch (unit) {
      case 'B':
        return value;
      case 'KB':
        return value * 1024;
      case 'MB':
        return value * 1024 * 1024;
      case 'GB':
        return value * 1024 * 1024 * 1024;
      default:
        return 0;
    }
  };

  // Convert bytes to human-readable format (e.g., "8.00 MB")
  const formatBytesToHumanReadable = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Handle file drop or selection
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Calculate the total size of new files being added (in bytes)
    const newFilesSize = acceptedFiles.reduce((acc, file) => acc + file.size, 0);

    // Check if the total size exceeds the maximum limit (10 MB = 10 * 1024 * 1024 bytes)
    if (totalSize + newFilesSize > MAX_TOTAL_SIZE) {
      toast.error(`Total file size exceeds the maximum limit of ${formatBytesToHumanReadable(MAX_TOTAL_SIZE)}.`);
      return;
    }

    // Add new files to the state
    const addedFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9), // Generate a unique ID for new files
      name: file.name,
      type: file.type,
      size: file.size, // Size in bytes for calculations
      displaySize: formatBytesToHumanReadable(file.size), // Human-readable format for display
      uploadDate: new Date(),
      url: URL.createObjectURL(file),
      file, // Include the actual File object for newly uploaded files
    }));

    // Update the total size
    setTotalSize((prev) => prev + newFilesSize);

    // Update the newFiles state
    setNewFiles((prev) => [...prev, ...addedFiles]);
    toast.success("Files added successfully");
  }, [totalSize]);

  // Handle file deletion
  const handleDelete = async (id: string) => {
    const fileToDelete = [...existingFiles, ...newFiles].find((file) => file.id === id);
    if (fileToDelete) {
      if (existingFiles.some((file) => file.id === id)) {
        // File is in the database: Delete via API
        try {
          await authApi.deleteFile(id);
          setExistingFiles((prev) => prev.filter((file) => file.id !== id));
          setTotalSize((prev) => prev - fileToDelete.size);
          toast.success("File deleted from database");
        } catch (error) {
          toast.error("Failed to delete file from database");
        }
      } else {
        // File is in user state: Remove from newFiles
        setNewFiles((prev) => prev.filter((file) => file.id !== id));
        setTotalSize((prev) => prev - fileToDelete.size);
        toast.success("File removed from user state");
      }
    }
  };

  // Handle save action
  const handleSave = async () => {
    if (!selectedBot) {
      toast.error("No bot selected.");
      return;
    }
    try {
      // Upload new files
      if (newFiles.length > 0) {
        const filesToUpload = newFiles.map((file) => file.file).filter((file): file is File => file !== undefined);
        await authApi.uploadFiles(filesToUpload, selectedBot.id);
        toast.success("Files saved successfully");

        // Fetch the updated list of files from the database
        await fetchFiles();

        // Clear the newFiles state
        setNewFiles([]);
      } else {
        toast.info("No new files to save");
      }
    } catch (error) {
      toast.error("An error occurred while saving files");
    }
  };

  // Combine existing and new files for display
  const allFiles = [...existingFiles, ...newFiles];

  // Disable save button if there are no new files
  const isSaveDisabled = newFiles.length === 0;

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

  return (
    <div className="space-y-6">
      <ToastContainer />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">File Upload</h1>

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
          {isDragActive ? 'Drop the files here...' : 'Drag & drop files here, or click to select files'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Supported files: PDF, DOC, DOCX, XLS, XLSX, Images
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Uploaded Files</h2>
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
              {allFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <File className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900 dark:text-white">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {file.type ? (file.type.includes('/') ? file.type.split('/')[1].toUpperCase() : file.type.toUpperCase()) : 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatBytesToHumanReadable(file.size)}
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

      <button
        onClick={handleSave}
        disabled={isSaveDisabled}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>
  );
};
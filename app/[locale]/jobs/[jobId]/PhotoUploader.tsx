/**
 * PhotoUploader Component
 * 
 * Handles client-side photo uploads to S3 using presigned URLs
 * Phase 3: 2-step upload flow (presign -> upload to S3 -> commit)
 */

'use client';

import { useState } from 'react';

interface PhotoUploaderProps {
  jobId: string;
  onUploadComplete?: () => void;
  maxFiles?: number;
}

interface UploadFile {
  file: File;
  category: 'before' | 'after' | 'damage' | 'other';
  progress: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

export default function PhotoUploader({ jobId, onUploadComplete, maxFiles = 10 }: PhotoUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    
    if (invalidFiles.length > 0) {
      alert('Only image files (JPEG, PNG, GIF, WebP) are allowed');
      return;
    }

    // Validate file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      alert('Files must be smaller than 10MB');
      return;
    }

    const newFiles: UploadFile[] = files.map(file => ({
      file,
      category: 'other',
      progress: 0,
      status: 'pending',
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleCategoryChange = (index: number, category: UploadFile['category']) => {
    setSelectedFiles(prev =>
      prev.map((f, i) => (i === index ? { ...f, category } : f))
    );
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      // Step 1: Get presigned URLs
      const presignRequest = {
        files: selectedFiles.map(f => ({
          filename: f.file.name,
          contentType: f.file.type,
          category: f.category,
        })),
      };

      const presignResponse = await fetch(`/api/jobs/${jobId}/photos/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presignRequest),
      });

      if (!presignResponse.ok) {
        throw new Error('Failed to get presigned URLs');
      }

      const presignData = await presignResponse.json();

      if (!presignData.success || !presignData.data?.uploads) {
        throw new Error('Invalid presign response');
      }

      const uploads = presignData.data.uploads;

      // Step 2: Upload files to S3
      const uploadPromises = uploads.map(async (upload: any, index: number) => {
        try {
          setSelectedFiles(prev =>
            prev.map((f, i) => (i === index ? { ...f, status: 'uploading' as const } : f))
          );

          const file = selectedFiles[index].file;
          
          const uploadResponse = await fetch(upload.putUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type,
            },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`S3 upload failed: ${uploadResponse.status}`);
          }

          setSelectedFiles(prev =>
            prev.map((f, i) => (i === index ? { ...f, status: 'uploaded' as const, progress: 100 } : f))
          );

          return {
            photoId: upload.photoId,
            s3Key: upload.s3Key,
            publicUrl: upload.publicUrl,
            contentType: file.type,
            category: upload.category,
          };
        } catch (error) {
          setSelectedFiles(prev =>
            prev.map((f, i) =>
              i === index ? { ...f, status: 'error' as const, error: (error as Error).message } : f
            )
          );
          throw error;
        }
      });

      const uploadedPhotos = await Promise.all(uploadPromises);

      // Step 3: Commit photos to job record
      const commitResponse = await fetch(`/api/jobs/${jobId}/photos/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: uploadedPhotos }),
      });

      if (!commitResponse.ok) {
        throw new Error('Failed to commit photos');
      }

      const commitData = await commitResponse.json();

      if (commitData.success) {
        alert('Photos uploaded successfully!');
        setSelectedFiles([]);
        onUploadComplete?.();
      } else {
        throw new Error(commitData.error?.message || 'Failed to commit photos');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Input */}
      <div>
        <label className="block">
          <div className="px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-primary-500 transition">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <div className="text-gray-600">
              📷 Click to select photos (max {maxFiles})
            </div>
          </div>
        </label>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          {selectedFiles.map((fileItem, index) => (
            <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900">{fileItem.file.name}</div>
                <div className="text-xs text-gray-500">
                  {(fileItem.file.size / 1024).toFixed(1)} KB
                </div>
                {fileItem.status === 'uploading' && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${fileItem.progress}%` }}
                    ></div>
                  </div>
                )}
                {fileItem.status === 'error' && (
                  <div className="text-xs text-red-600 mt-1">{fileItem.error}</div>
                )}
              </div>

              <select
                value={fileItem.category}
                onChange={(e) => handleCategoryChange(index, e.target.value as UploadFile['category'])}
                disabled={uploading}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="before">Before</option>
                <option value="after">After</option>
                <option value="damage">Damage</option>
                <option value="other">Other</option>
              </select>

              <button
                onClick={() => handleRemoveFile(index)}
                disabled={uploading}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {selectedFiles.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`w-full px-6 py-3 rounded-lg font-medium transition ${
            uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} photo${selectedFiles.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

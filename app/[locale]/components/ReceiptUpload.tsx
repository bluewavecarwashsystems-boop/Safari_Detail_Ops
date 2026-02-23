/**
 * Receipt Upload Component with Camera Access
 * Features:
 * - Direct camera access on mobile
 * - Client-side image compression
 * - Upload progress indicator
 * - Preview before upload
 * - Validation and error handling
 */

'use client';

import { useState, useRef } from 'react';
import { compressImage, formatFileSize, validateImageFile } from '@/lib/utils/imageCompression';

interface ReceiptUploadProps {
  jobId: string;
  onUploadComplete: (receiptUrl: string) => void;
  onCancel?: () => void;
}

export function ReceiptUpload({
  jobId,
  onUploadComplete,
  onCancel,
}: ReceiptUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Compress image
    try {
      setIsCompressing(true);
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        mimeType: 'image/jpeg',
      });
      setCompressedSize(compressed.size);
      setIsCompressing(false);
    } catch (err) {
      console.error('Compression failed:', err);
      setError('Failed to process image');
      setIsCompressing(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Step 1: Compress image
      setUploadProgress(10);
      const compressed = await compressImage(selectedFile, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        mimeType: 'image/jpeg',
      });

      // Step 2: Get presigned URL
      setUploadProgress(20);
      const filenameResponse = await fetch(`/api/jobs/${jobId}/receipt-upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'image/jpeg',
          originalFilename: selectedFile.name,
        }),
      });

      if (!filenameResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, receiptUrl } = await filenameResponse.json();

      // Step 3: Upload to S3
      setUploadProgress(40);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: compressed,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      setUploadProgress(80);

      // Step 4: Update job with receipt URL
      const updateResponse = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptImageUrl: receiptUrl,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to save receipt');
      }

      setUploadProgress(100);
      onUploadComplete(receiptUrl);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompressedSize(null);
    setError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Upload Receipt</h2>
        <p className="text-sm text-gray-600 mt-1">
          Required before marking job as paid
        </p>
      </div>

      {/* File Input - Camera on mobile */}
      {!selectedFile && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="receipt-input"
          />
          <label
            htmlFor="receipt-input"
            className="
              flex flex-col items-center justify-center
              w-full h-48 border-2 border-dashed border-gray-300
              rounded-lg cursor-pointer bg-gray-50
              hover:bg-gray-100 transition-colors
            "
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-12 h-12 mb-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-700 font-medium">
                <span className="font-semibold">Take Photo</span> or upload file
              </p>
              <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
            </div>
          </label>
        </div>
      )}

      {/* Preview & Upload */}
      {selectedFile && previewUrl && (
        <div>
          {/* Image Preview */}
          <div className="mb-4">
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="w-full rounded-lg border border-gray-300"
            />
          </div>

          {/* File Info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Original:</span>
              <span className="font-medium">{formatFileSize(selectedFile.size)}</span>
            </div>
            {compressedSize && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Compressed:</span>
                <span className="font-medium text-green-600">
                  {formatFileSize(compressedSize)}
                </span>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {isUploading && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center mt-2">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={isUploading || isCompressing}
              className="
                flex-1 h-12 bg-gray-200 hover:bg-gray-300
                text-gray-700 font-medium rounded-lg
                transition-colors disabled:opacity-50
              "
            >
              Retake
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || isCompressing}
              className="
                flex-1 h-12 bg-green-600 hover:bg-green-700
                text-white font-medium rounded-lg
                transition-colors disabled:opacity-50
                flex items-center justify-center gap-2
              "
            >
              {isCompressing ? (
                <>Processing...</>
              ) : isUploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <span>✓</span>
                  <span>Upload Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          disabled={isUploading}
          className="
            w-full mt-3 h-12 bg-white hover:bg-gray-50
            text-gray-700 font-medium rounded-lg border-2 border-gray-300
            transition-colors disabled:opacity-50
          "
        >
          Cancel
        </button>
      )}
    </div>
  );
}

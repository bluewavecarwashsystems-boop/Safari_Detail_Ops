/**
 * Sticky Action Bar for Job Status Transitions
 * Fixed at bottom of screen for mobile-first UX
 * Minimum 48px tap targets
 */

'use client';

import { WorkStatus, PaymentStatus } from '@/lib/types';
import { useState } from 'react';

interface StickyActionBarProps {
  currentStatus: WorkStatus;
  paymentStatus: PaymentStatus;
  hasReceipt: boolean;
  onStatusChange: (newStatus: WorkStatus) => Promise<void>;
  onPaymentToggle: () => void;
  onReceiptUpload: () => void;
  isUpdating?: boolean;
}

export function StickyActionBar({
  currentStatus,
  paymentStatus,
  hasReceipt,
  onStatusChange,
  onPaymentToggle,
  onReceiptUpload,
  isUpdating = false,
}: StickyActionBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Define possible next statuses based on current status
  const getNextStatuses = (): { status: WorkStatus; label: string; icon: string }[] => {
    // No actions available for cancelled jobs
    if (currentStatus === WorkStatus.CANCELLED) {
      return [];
    }
    
    switch (currentStatus) {
      case WorkStatus.SCHEDULED:
        return [
          { status: WorkStatus.CHECKED_IN, label: 'Check In', icon: '📋' },
        ];
      case WorkStatus.CHECKED_IN:
        return [
          { status: WorkStatus.IN_PROGRESS, label: 'Start Work', icon: '🔧' },
        ];
      case WorkStatus.IN_PROGRESS:
        return [
          { status: WorkStatus.QC_READY, label: 'QC Ready', icon: '✓' },
        ];
      case WorkStatus.QC_READY:
        return [
          { status: WorkStatus.WORK_COMPLETED, label: 'Complete', icon: '✓✓' },
        ];
      case WorkStatus.WORK_COMPLETED:
        return [];
      default:
        return [];
    }
  };

  const nextStatuses = getNextStatuses();
  const canMarkPaid = currentStatus === WorkStatus.WORK_COMPLETED;
  const isPaid = paymentStatus === PaymentStatus.PAID;

  return (
    <>
      {/* Spacer to prevent content from being hidden behind fixed bar */}
      <div className="h-20" />

      {/* Fixed Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-40">
        <div className="max-w-lg mx-auto px-4 py-3">
          {/* Status Actions */}
          {nextStatuses.length > 0 && (
            <div className="flex gap-2 mb-2">
              {nextStatuses.map(({ status, label, icon }) => (
                <button
                  key={status}
                  onClick={() => onStatusChange(status)}
                  disabled={isUpdating}
                  className="
                    flex-1 h-12 bg-blue-600 hover:bg-blue-700 
                    text-white font-medium rounded-lg
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2
                  "
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Payment & Receipt Actions */}
          {canMarkPaid && (
            <div className="flex gap-2">
              {/* Payment Toggle */}
              <button
                onClick={() => {
                  if (!isPaid && !hasReceipt) {
                    // Must upload receipt first
                    alert('Please upload receipt before marking as paid');
                    onReceiptUpload();
                    return;
                  }
                  onPaymentToggle();
                }}
                disabled={isUpdating}
                className={`
                  flex-1 h-12 font-medium rounded-lg
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                  ${
                    isPaid
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }
                `}
              >
                <span>{isPaid ? '✓' : '○'}</span>
                <span>{isPaid ? 'Paid' : 'Mark Paid'}</span>
              </button>

              {/* Receipt Upload */}
              {!isPaid && (
                <button
                  onClick={onReceiptUpload}
                  disabled={isUpdating}
                  className={`
                    flex-1 h-12 font-medium rounded-lg
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2
                    ${
                      hasReceipt
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }
                  `}
                >
                  <span>📷</span>
                  <span>{hasReceipt ? 'Receipt ✓' : 'Add Receipt'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

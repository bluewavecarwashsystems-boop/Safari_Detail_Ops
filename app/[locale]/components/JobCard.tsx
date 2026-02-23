/**
 * Mobile-First Job Card Component
 * Replaces table layout with card-based design
 * Minimum 48px tap targets for mobile
 */

'use client';

import { WorkStatus, PaymentStatus } from '@/lib/types';
import { PaymentBadge } from './PaymentBadge';

interface JobCardProps {
  jobId: string;
  customerName: string;
  vehicleInfo: string;
  serviceType: string;
  scheduledStart: string;
  workStatus: WorkStatus;
  paymentStatus: PaymentStatus;
  hasOpenIssue: boolean;
  onStatusChange?: (jobId: string, newStatus: WorkStatus) => void;
  onPaymentToggle?: (jobId: string) => void;
  onViewDetails?: (jobId: string) => void;
  isUpdating?: boolean;
}

export function JobCard({
  jobId,
  customerName,
  vehicleInfo,
  serviceType,
  scheduledStart,
  workStatus,
  paymentStatus,
  hasOpenIssue,
  onStatusChange,
  onPaymentToggle,
  onViewDetails,
  isUpdating = false,
}: JobCardProps) {
  const statusColors: Record<WorkStatus, string> = {
    [WorkStatus.SCHEDULED]: 'bg-slate-100 text-slate-700 border-slate-300',
    [WorkStatus.CHECKED_IN]: 'bg-blue-100 text-blue-700 border-blue-300',
    [WorkStatus.IN_PROGRESS]: 'bg-orange-100 text-orange-700 border-orange-300',
    [WorkStatus.QC_READY]: 'bg-purple-100 text-purple-700 border-purple-300',
    [WorkStatus.WORK_COMPLETED]: 'bg-green-100 text-green-700 border-green-300',
    [WorkStatus.NO_SHOW_PENDING_CHARGE]: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    [WorkStatus.NO_SHOW_CHARGED]: 'bg-red-100 text-red-700 border-red-300',
    [WorkStatus.NO_SHOW_FAILED]: 'bg-red-100 text-red-700 border-red-300',
  };

  const statusLabels: Record<WorkStatus, string> = {
    [WorkStatus.SCHEDULED]: 'Scheduled',
    [WorkStatus.CHECKED_IN]: 'Checked In',
    [WorkStatus.IN_PROGRESS]: 'In Progress',
    [WorkStatus.QC_READY]: 'QC Ready',
    [WorkStatus.WORK_COMPLETED]: 'Completed',
    [WorkStatus.NO_SHOW_PENDING_CHARGE]: 'No Show (Pending)',
    [WorkStatus.NO_SHOW_CHARGED]: 'No Show (Charged)',
    [WorkStatus.NO_SHOW_FAILED]: 'No Show (Failed)',
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div
      className={`
        bg-white rounded-lg border-2 shadow-sm p-4 mb-3
        ${hasOpenIssue ? 'border-red-500' : 'border-gray-200'}
        ${isUpdating ? 'opacity-50' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {customerName}
          </h3>
          <p className="text-sm text-gray-600">{vehicleInfo}</p>
        </div>
        <PaymentBadge status={paymentStatus} />
      </div>

      {/* Service & Time */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
        <div>
          <p className="text-sm font-medium text-gray-700">{serviceType}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatTime(scheduledStart)}
          </p>
        </div>
        <span
          className={`
            px-3 py-1 rounded-full text-sm font-medium border
            ${statusColors[workStatus]}
          `}
        >
          {statusLabels[workStatus]}
        </span>
      </div>

      {/* Issue Warning */}
      {hasOpenIssue && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700 font-medium">⚠️ Open Issue</p>
        </div>
      )}

      {/* Action Button - 48px minimum tap target */}
      <button
        onClick={() => onViewDetails?.(jobId)}
        disabled={isUpdating}
        className="
          w-full h-12 bg-blue-600 hover:bg-blue-700 
          text-white font-medium rounded-lg
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center
        "
      >
        View Details
      </button>
    </div>
  );
}

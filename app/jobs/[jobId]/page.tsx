'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { WorkStatus, PaymentStatus } from '../../../lib/types';

interface Job {
  jobId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  vehicleInfo: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    licensePlate?: string;
  };
  serviceType: string;
  scheduledStart?: string;
  appointmentTime?: string;
  workStatus: WorkStatus;
  status: string; // API returns lowercase status
  payment?: {
    status: PaymentStatus;
    amountCents?: number;
  };
  checklist?: Array<{ label: string; completed: boolean }>;
  checkinPhotos?: string[];
  checkinPhotosRequired?: number;
}

export default function JobDetail() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        setLoading(true);
        const jobId = params.jobId as string;
        const response = await fetch(`/api/jobs/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch job: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
          const apiJob = data.data;
          
          // Map API response to component state
          setJob({
            jobId: apiJob.jobId,
            customerName: apiJob.customerName || 'Unknown Customer',
            customerPhone: apiJob.customerPhone,
            customerEmail: apiJob.customerEmail,
            vehicleInfo: apiJob.vehicleInfo || {},
            serviceType: apiJob.serviceType || 'Service details pending',
            scheduledStart: apiJob.appointmentTime || apiJob.createdAt,
            appointmentTime: apiJob.appointmentTime,
            workStatus: (apiJob.status?.toUpperCase() as WorkStatus) || WorkStatus.SCHEDULED,
            status: apiJob.status,
            payment: {
              status: PaymentStatus.UNPAID,
              amountCents: 0,
            },
            checklist: [
              { label: 'Vacuum interior', completed: false },
              { label: 'Clean windows', completed: false },
              { label: 'Wash exterior', completed: false },
              { label: 'Dry & detail', completed: false },
            ],
            checkinPhotos: apiJob.photos || [],
            checkinPhotosRequired: 4,
          });
        } else {
          throw new Error('Invalid API response');
        }
      } catch (err) {
        console.error('Failed to fetch job:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [params.jobId]);

  const handleStatusChange = (newStatus: WorkStatus) => {
    if (!job) return;
    setJob({ ...job, workStatus: newStatus });
    // TODO: API call to update status
  };

  const handleChecklistToggle = (index: number) => {
    if (!job) return;
    const newChecklist = [...(job.checklist || [])];
    newChecklist[index].completed = !newChecklist[index].completed;
    setJob({ ...job, checklist: newChecklist });
    // TODO: API call to update checklist
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Failed to Load Job</h2>
          <p className="text-gray-600 mb-4">{error || 'Job not found'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-primary-700 rounded-lg hover:bg-primary-800 transition"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold">Job Details</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Customer Info */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">👤 Customer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Name</label>
              <div className="font-medium">{job.customerName}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Phone</label>
              <div className="font-medium">{job.customerPhone || 'Not provided'}</div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Email</label>
              <div className="font-medium">{job.customerEmail || 'Not provided'}</div>
            </div>
          </div>
        </section>

        {/* Vehicle Info */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🚗 Vehicle</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Make/Model</label>
              <div className="font-medium">
                {job.vehicleInfo.year || job.vehicleInfo.make || job.vehicleInfo.model
                  ? `${job.vehicleInfo.year || ''} ${job.vehicleInfo.make || ''} ${job.vehicleInfo.model || ''}`.trim()
                  : 'Pending'}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600">License Plate</label>
              <div className="font-medium">{job.vehicleInfo.licensePlate || 'Pending'}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Color</label>
              <div className="font-medium">{job.vehicleInfo.color || 'Pending'}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Service</label>
              <div className="font-medium text-sm">{job.serviceType}</div>
            </div>
          </div>
        </section>

        {/* Status & Actions */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 Status</h2>
          <div className="mb-4">
            <label className="text-sm text-gray-600">Current Status</label>
            <div className="text-xl font-bold text-primary-600">{job.workStatus}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            {job.workStatus === WorkStatus.SCHEDULED && (
              <button
                onClick={() => handleStatusChange(WorkStatus.CHECKED_IN)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
              >
                ✅ Check In
              </button>
            )}
            {job.workStatus === WorkStatus.CHECKED_IN && (
              <button
                onClick={() => handleStatusChange(WorkStatus.IN_PROGRESS)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                🔧 Start Work
              </button>
            )}
            {job.workStatus === WorkStatus.IN_PROGRESS && (
              <button
                onClick={() => handleStatusChange(WorkStatus.QC_READY)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
              >
                🔍 Request QC
              </button>
            )}
            {job.workStatus === WorkStatus.QC_READY && (
              <button
                onClick={() => handleStatusChange(WorkStatus.WORK_COMPLETED)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
              >
                ✨ Complete Work
              </button>
            )}
          </div>
        </section>

        {/* Checklist */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">✓ Checklist</h2>
          <div className="space-y-3">
            {(job.checklist || []).map((item, index) => (
              <label
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => handleChecklistToggle(index)}
                  className="w-6 h-6 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className={item.completed ? 'line-through text-gray-500' : 'text-gray-900'}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📸 Photos</h2>
          <div className="text-sm text-gray-600 mb-4">
            {(job.checkinPhotos || []).length} of {job.checkinPhotosRequired || 4} required photos uploaded
          </div>
          <button className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition">
            📷 Upload Photo
          </button>
        </section>

        {/* Payment */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">💳 Payment</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Amount</div>
              <div className="text-2xl font-bold text-gray-900">
                ${((job.payment?.amountCents || 0) / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-lg font-medium ${
                job.payment?.status === PaymentStatus.PAID
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {job.payment?.status || PaymentStatus.UNPAID}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

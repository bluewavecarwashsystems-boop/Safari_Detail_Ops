'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n/provider';
import { WorkStatus, PaymentStatus, ChecklistItem } from '@/lib/types';
import type { Locale } from '@/i18n';
import PhotoUploader from './PhotoUploader';

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
  status: string;
  payment?: {
    status: PaymentStatus;
    amountCents?: number;
  };
  checklist?: {
    tech?: ChecklistItem[];
    qc?: ChecklistItem[];
  };
  photosMeta?: Array<any>;
  customerCached?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export default function JobDetail() {
  const t = useTranslations('job');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as Locale;
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchJob = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/jobs/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const apiJob = data.data;
        
        // Initialize default checklists if not present
        const defaultTechChecklist: ChecklistItem[] = [
          { id: 'tech-1', label: t('checklist.vacuumInterior'), checked: false },
          { id: 'tech-2', label: t('checklist.cleanWindows'), checked: false },
          { id: 'tech-3', label: t('checklist.washExterior'), checked: false },
          { id: 'tech-4', label: t('checklist.dryDetail'), checked: false },
        ];
        
        const defaultQcChecklist: ChecklistItem[] = [
          { id: 'qc-1', label: 'Inspect interior cleanliness', checked: false },
          { id: 'qc-2', label: 'Check exterior finish', checked: false },
          { id: 'qc-3', label: 'Verify all surfaces dry', checked: false },
        ];
        
        setJob({
          jobId: apiJob.jobId,
          customerName: apiJob.customerCached?.name || apiJob.customerName || 'Unknown Customer',
          customerPhone: apiJob.customerCached?.phone || apiJob.customerPhone,
          customerEmail: apiJob.customerCached?.email || apiJob.customerEmail,
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
          checklist: {
            tech: apiJob.checklist?.tech || defaultTechChecklist,
            qc: apiJob.checklist?.qc || defaultQcChecklist,
          },
          photosMeta: apiJob.photosMeta || [],
          customerCached: apiJob.customerCached,
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
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const refreshJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const apiJob = data.data;
          setJob(prev => prev ? {
            ...prev,
            photosMeta: apiJob.photosMeta || [],
            checklist: apiJob.checklist || prev.checklist,
          } : null);
        }
      }
    } catch (err) {
      console.error('Failed to refresh job:', err);
    }
  };

  const handleStatusChange = async (newStatus: WorkStatus) => {
    if (!job || updating) return;
    
    setUpdating(true);
    const previousStatus = job.workStatus;

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workStatus: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update status');
      }

      const data = await response.json();

      if (data.success && data.data?.job) {
        setJob({ ...job, workStatus: newStatus, status: newStatus });
        showToast('Status updated successfully', 'success');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast((err as Error).message, 'error');
      setJob({ ...job, workStatus: previousStatus });
    } finally {
      setUpdating(false);
    }
  };

  const handleChecklistToggle = async (type: 'tech' | 'qc', itemId: string) => {
    if (!job || updating) return;

    const currentChecklist = job.checklist?.[type] || [];
    const updatedChecklist = currentChecklist.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    setJob({
      ...job,
      checklist: {
        ...job.checklist!,
        [type]: updatedChecklist,
      },
    });

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist: {
            [type]: updatedChecklist,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update checklist');
      }

      const data = await response.json();

      if (data.success && data.data?.job) {
        if (data.data.job.checklist) {
          setJob(prev => prev ? { ...prev, checklist: data.data.job.checklist } : null);
        }
      }
    } catch (err) {
      console.error('Failed to update checklist:', err);
      showToast('Failed to save checklist change', 'error');
      setJob({
        ...job,
        checklist: {
          ...job.checklist!,
          [type]: currentChecklist,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-gray-600">{t('loadingDetails')}</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">{t('failedToLoad')}</h2>
          <p className="text-gray-600 mb-4">{error || t('notFound')}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            ← {t('goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-primary-700 rounded-lg hover:bg-primary-800 transition"
            >
              {locale === 'ar' ? '→' : '←'} {tCommon('back')}
            </button>
            <h1 className="text-xl font-bold">{t('title')}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Customer Info */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">👤 {t('customer.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">{t('customer.name')}</label>
              <div className="font-medium text-gray-900">{job.customerName}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">{t('customer.phone')}</label>
              <div className="font-medium text-gray-900">{job.customerPhone || t('customer.notProvided')}</div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">{t('customer.email')}</label>
              <div className="font-medium text-gray-900">{job.customerEmail || t('customer.notProvided')}</div>
            </div>
          </div>
        </section>

        {/* Vehicle Info */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🚗 {t('vehicle.title')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">{t('vehicle.makeModel')}</label>
              <div className="font-medium text-gray-900">
                {job.vehicleInfo.year || job.vehicleInfo.make || job.vehicleInfo.model
                  ? `${job.vehicleInfo.year || ''} ${job.vehicleInfo.make || ''} ${job.vehicleInfo.model || ''}`.trim()
                  : t('vehicle.pending')}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600">{t('vehicle.licensePlate')}</label>
              <div className="font-medium text-gray-900">{job.vehicleInfo.licensePlate || t('vehicle.pending')}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">{t('vehicle.color')}</label>
              <div className="font-medium text-gray-900">{job.vehicleInfo.color || t('vehicle.pending')}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">{t('vehicle.service')}</label>
              <div className="font-medium text-sm text-gray-900">{job.serviceType}</div>
            </div>
          </div>
        </section>

        {/* Status & Actions */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 {t('status.title')}</h2>
          <div className="mb-4">
            <label className="text-sm text-gray-600">{t('status.current')}</label>
            <div className="text-xl font-bold text-primary-600">{job.workStatus}</div>
          </div>

          <div className="flex flex-wrap gap-3">
            {job.workStatus === WorkStatus.SCHEDULED && (
              <button
                onClick={() => handleStatusChange(WorkStatus.CHECKED_IN)}
                disabled={updating}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                ✅ {t('actions.checkIn')}
              </button>
            )}
            {job.workStatus === WorkStatus.CHECKED_IN && (
              <button
                onClick={() => handleStatusChange(WorkStatus.IN_PROGRESS)}
                disabled={updating}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              >
                🔧 {t('actions.startWork')}
              </button>
            )}
            {job.workStatus === WorkStatus.IN_PROGRESS && (
              <button
                onClick={() => handleStatusChange(WorkStatus.QC_READY)}
                disabled={updating}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50"
              >
                🔍 {t('actions.requestQC')}
              </button>
            )}
            {job.workStatus === WorkStatus.QC_READY && (
              <button
                onClick={() => handleStatusChange(WorkStatus.WORK_COMPLETED)}
                disabled={updating}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                ✨ {t('actions.completeWork')}
              </button>
            )}
          </div>
        </section>

        {/* Checklist */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">✓ {t('checklist.title')}</h2>
          
          {/* Tech Checklist */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-700 mb-3">🔧 Tech Checklist</h3>
            <div className="space-y-3">
              {(job.checklist?.tech || []).map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleChecklistToggle('tech', item.id)}
                    disabled={updating}
                    className="w-6 h-6 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className={item.checked ? 'line-through text-gray-500' : 'text-gray-900'}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* QC Checklist */}
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-3">🔍 QC Checklist</h3>
            <div className="space-y-3">
              {(job.checklist?.qc || []).map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleChecklistToggle('qc', item.id)}
                    disabled={updating}
                    className="w-6 h-6 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className={item.checked ? 'line-through text-gray-500' : 'text-gray-900'}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📸 {t('photos.title')}</h2>
          <div className="text-sm text-gray-600 mb-4">
            {(job.photosMeta || []).length} photos uploaded
          </div>
          
          {/* Photo Gallery */}
          {job.photosMeta && job.photosMeta.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {job.photosMeta.map((photo, idx) => (
                <div 
                  key={idx} 
                  className="relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={photo.publicUrl}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {photo.category && (
                    <span className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded">
                      {photo.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Upload Toggle Button */}
          <button 
            onClick={() => setShowPhotoUploader(!showPhotoUploader)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition"
          >
            📷 {showPhotoUploader ? 'Hide Uploader' : 'Upload Photos'}
          </button>

          {/* Photo Uploader */}
          {showPhotoUploader && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <PhotoUploader 
                jobId={jobId}
                onUploadComplete={() => {
                  setShowPhotoUploader(false);
                  refreshJob();
                }}
              />
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">💳 {t('payment.title')}</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">{t('payment.amount')}</div>
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

      {/* Photo Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={selectedPhoto.publicUrl}
              alt="Full size photo"
              className="max-w-full max-h-screen rounded-lg"
            />
            <div className="mt-4 text-white text-center">
              <div className="text-sm">
                Category: {selectedPhoto.category || 'N/A'}
              </div>
              <div className="text-xs text-gray-300 mt-1">
                Uploaded: {new Date(selectedPhoto.uploadedAt).toLocaleString()}
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="mt-4 px-6 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

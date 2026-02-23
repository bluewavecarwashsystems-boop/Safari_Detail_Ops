'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from '@/lib/i18n/provider';
import { WorkStatus, PaymentStatus } from '@/lib/types';
import type { Locale } from '@/i18n';
import { PaymentBadge } from './components/PaymentBadge';

interface JobCard {
  jobId: string;
  customerName: string;
  vehicleInfo: string;
  serviceType: string;
  scheduledStart: string;
  workStatus: WorkStatus;
  hasOpenIssue: boolean;
  paymentStatus: PaymentStatus;
  noShow?: {
    status: 'NONE' | 'NO_SHOW' | 'RESOLVED';
    reason?: string;
  };
}

const mockJobs: JobCard[] = [
  {
    jobId: '1',
    customerName: 'John Doe',
    vehicleInfo: '2020 Tesla Model 3 - ABC123',
    serviceType: 'Full Detail',
    scheduledStart: '2026-02-05T09:00:00Z',
    workStatus: WorkStatus.SCHEDULED,
    hasOpenIssue: false,
    paymentStatus: PaymentStatus.UNPAID,
  },
  {
    jobId: '2',
    customerName: 'Jane Smith',
    vehicleInfo: '2019 Honda Accord - XYZ789',
    serviceType: 'Express Wash',
    scheduledStart: '2026-02-05T10:00:00Z',
    workStatus: WorkStatus.CHECKED_IN,
    hasOpenIssue: false,
    paymentStatus: PaymentStatus.PAID,
  },
];

export default function TodayBoard() {
  const t = useTranslations('today');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const params = useParams();
  const locale = params.locale as Locale;

  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [updatingJobs, setUpdatingJobs] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<'TECH' | 'MANAGER' | null>(null);
  const [boardDate, setBoardDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const columns = [
    { status: WorkStatus.SCHEDULED, title: t('status.scheduled'), icon: '📅', color: '#64748B' },
    { status: WorkStatus.CHECKED_IN, title: t('status.checkedIn'), icon: '✅', color: '#2563EB' },
    { status: WorkStatus.IN_PROGRESS, title: t('status.inProgress'), icon: '🔧', color: '#F47C20' },
    { status: WorkStatus.QC_READY, title: t('status.qcReady'), icon: '🔍', color: '#7C3AED' },
    { status: WorkStatus.WORK_COMPLETED, title: t('status.workCompleted'), icon: '✨', color: '#16A34A' },
  ];

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateJobStatus = async (jobId: string, newStatus: WorkStatus) => {
    setUpdatingJobs(prev => new Set(prev).add(jobId));

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workStatus: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.job) {
        setJobs(prevJobs =>
          prevJobs.map(job =>
            job.jobId === jobId ? { ...job, workStatus: newStatus } : job
          )
        );
        showToast('Status updated successfully', 'success');
      } else {
        throw new Error(data.error?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Failed to update job status:', err);
      showToast((err as Error).message, 'error');
    } finally {
      setUpdatingJobs(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const getNextStatus = (currentStatus: WorkStatus): WorkStatus | null => {
    const workflow = [
      WorkStatus.SCHEDULED,
      WorkStatus.CHECKED_IN,
      WorkStatus.IN_PROGRESS,
      WorkStatus.QC_READY,
      WorkStatus.WORK_COMPLETED,
    ];
    const currentIndex = workflow.indexOf(currentStatus);
    return currentIndex < workflow.length - 1 ? workflow[currentIndex + 1] : null;
  };

  // Parse date string without timezone conversion issues
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return boardDate === today;
  };

  const getBoardTitle = () => {
    if (isToday()) {
      return t('boardTitle'); // "Today's Board"
    }
    // For other dates, show "Board for [Date]"
    return `Board for ${parseLocalDate(boardDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale === 'es' ? 'es-ES' : 'en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })}`;
  };

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.user) {
            setUserRole(data.data.user.role);
          }
        }
      } catch (err) {
        console.error('Failed to fetch user:', err);
      }
    }

    async function fetchJobs() {
      try {
        setLoading(true);
        const response = await fetch(`/api/jobs?boardDate=${boardDate}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch jobs: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data?.jobs) {
          const formattedJobs: JobCard[] = data.data.jobs.map((job: any) => ({
            jobId: job.jobId,
            customerName: job.customerName || 'Unknown',
            vehicleInfo: job.vehicleInfo?.year && job.vehicleInfo?.make 
              ? `${job.vehicleInfo.year} ${job.vehicleInfo.make} ${job.vehicleInfo.model || ''} - ${job.vehicleInfo.licensePlate || ''}`.trim()
              : 'Vehicle info pending',
            serviceType: job.serviceType || 'Detail Service',
            scheduledStart: job.appointmentTime || job.createdAt,
            workStatus: job.status,
            hasOpenIssue: job.postCompletionIssue?.isOpen || false,
            paymentStatus: job.payment?.status || PaymentStatus.UNPAID,
            noShow: job.noShow,
          }));
          setJobs(formattedJobs);
        } else {
          console.warn('API returned no jobs, using mock data');
          setJobs(mockJobs);
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
        setError((err as Error).message);
        setJobs(mockJobs);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
    fetchJobs();
  }, [boardDate]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--sf-bg)' }}>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {toast.message}
        </div>
      )}

      <header className="bg-white shadow-sm border-b-[3px] border-[#F47C20]" style={{ boxShadow: 'var(--sf-shadow)' }}>
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--sf-ink)' }}>🚗 {t('title')}</h1>
            <div className="flex gap-3">
              {userRole === 'MANAGER' && (
                <Link 
                  href={`/${locale}/manager/phone-booking`}
                  className="px-6 py-3 bg-[#F47C20] text-white rounded-xl font-medium hover:bg-[#DB6E1C] sf-button-transition"
                  style={{ boxShadow: 'var(--sf-shadow)' }}
                >
                  📞 {tNav('phoneBooking')}
                </Link>
              )}
              <Link 
                href={`/${locale}/calendar`}
                className="px-6 py-3 bg-white border border-[#E7E2D8] rounded-xl font-medium hover:bg-[#FAF6EF] sf-button-transition"
                style={{ color: 'var(--sf-ink)' }}
              >
                📆 {tNav('calendar')}
              </Link>
              <Link 
                href={`/${locale}/settings`}
                className="px-6 py-3 bg-white border border-[#E7E2D8] rounded-xl font-medium hover:bg-[#FAF6EF] sf-button-transition"
                style={{ color: 'var(--sf-ink)' }}
              >
                ⚙️ {tNav('settings')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--sf-ink)' }}>{getBoardTitle()}</h2>
            <div className="flex items-center gap-3">
              <label htmlFor="boardDate" className="text-sm font-medium" style={{ color: 'var(--sf-brown)' }}>
                📅 Board Date:
              </label>
              <input
                type="date"
                id="boardDate"
                value={boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#F47C20] focus:border-[#F47C20] shadow-sm bg-white"
                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-ink)' }}
              />
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0];
                  setBoardDate(today);
                }}
                className="px-4 py-2 text-sm font-medium bg-[#F47C20] text-white rounded-lg hover:bg-[#DB6E1C] sf-button-transition shadow-sm"
              >
                📆 Today
              </button>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--sf-muted)' }}>
            {parseLocalDate(boardDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : locale === 'es' ? 'es-ES' : 'en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          {error && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-800">
              ⚠️ {t('apiError', { error })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#F47C20]"></div>
            <p className="mt-2" style={{ color: 'var(--sf-muted)' }}>{t('loadingJobs')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {columns.map((column) => {
              const columnJobs = jobs.filter(job => job.workStatus === column.status);
              
              return (
                <div key={column.status} className="bg-transparent">
                  <div className="sticky top-0 bg-white border-b p-4 mb-4 rounded-t-2xl" style={{ borderColor: 'var(--sf-border)', boxShadow: 'var(--sf-shadow)' }}>
                    <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--sf-ink)' }}>
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: column.color }}
                      ></span>
                      <span>{column.title}</span>
                      <span 
                        className="ml-auto px-3 py-1 text-xs rounded-full font-medium bg-[#FAF6EF]"
                        style={{ color: 'var(--sf-brown)' }}
                      >
                        {columnJobs.length}
                      </span>
                    </h3>
                  </div>

                  <div className="space-y-3 px-1">
                    {columnJobs.length === 0 ? (
                      <div className="text-center py-8 text-sm" style={{ color: 'var(--sf-muted)' }}>
                        {t('noJobs')}
                      </div>
                    ) : (
                      columnJobs.map((job) => {
                        const nextStatus = getNextStatus(job.workStatus);
                        const isUpdating = updatingJobs.has(job.jobId);
                        const needsPaymentAttention = job.workStatus === WorkStatus.WORK_COMPLETED && job.paymentStatus === PaymentStatus.UNPAID;
                        
                        return (
                          <div
                            key={job.jobId}
                            className={`bg-white rounded-2xl p-4 border sf-card-hover ${
                              job.noShow?.status === 'NO_SHOW' ? 'border-orange-400' : 
                              needsPaymentAttention ? 'border-yellow-400 border-2 shadow-lg animate-pulse' :
                              'border-[#E7E2D8]'
                            }`}
                            style={{ 
                              boxShadow: 'var(--sf-shadow)',
                              borderLeft: `4px solid ${column.color}`
                            }}
                          >
                            <Link
                              href={`/${locale}/jobs/${job.jobId}`}
                              className="block hover:opacity-90 transition"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="font-semibold text-sm" style={{ color: 'var(--sf-ink)' }}>{job.customerName}</div>
                                <div className="flex gap-1 flex-wrap justify-end">
                                  <PaymentBadge status={job.paymentStatus} />
                                  {job.hasOpenIssue && (
                                    <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium border border-red-200">
                                      ⚠ Issue Open
                                    </span>
                                  )}
                                  {job.noShow?.status === 'NO_SHOW' && (
                                    <span className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-medium border border-orange-200">
                                      🚫 {t('job.noShow.badge' as any) || 'No-show'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs mb-2" style={{ color: 'var(--sf-muted)' }}>{job.vehicleInfo}</div>
                              <div className="text-sm font-medium mb-1" style={{ color: 'var(--sf-ink)' }}>{job.serviceType}</div>
                              <div className="text-xs font-medium" style={{ color: 'var(--sf-muted)' }}>
                                {new Date(job.scheduledStart).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : locale === 'es' ? 'es-ES' : 'en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </div>
                            </Link>
                            
                            {nextStatus && (
                              <button
                                onClick={() => updateJobStatus(job.jobId, nextStatus)}
                                disabled={isUpdating}
                                className={`mt-3 w-full h-9 px-3 text-sm font-medium rounded-lg sf-button-transition ${
                                  isUpdating
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-[#F47C20] text-white hover:bg-[#DB6E1C]'
                                }`}
                              >
                                {isUpdating ? 'Updating...' : `Move to ${columns.find(c => c.status === nextStatus)?.title}`}
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n';

interface Job {
  jobId: string;
  customerName: string;
  vehicleInfo?: {
    year?: string;
    make?: string;
    model?: string;
    licensePlate?: string;
  };
  serviceType: string;
  appointmentTime: string;
  status: string;
}

export default function CalendarPage() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const params = useParams();
  const locale = params.locale as Locale;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    async function fetchJobs() {
      try {
        setLoading(true);
        const response = await fetch('/api/jobs');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch jobs: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data?.jobs) {
          setJobs(data.data.jobs);
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, []);

  // Group jobs by date
  const jobsByDate = jobs.reduce((acc, job) => {
    const date = new Date(job.appointmentTime).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  // Get dates for the current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = locale === 'es' 
    ? ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    : locale === 'ar'
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayNames = locale === 'es'
    ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    : locale === 'ar'
    ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = new Date().toDateString();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href={`/${locale}`}
                className="text-2xl hover:opacity-80 transition"
              >
                {locale === 'ar' ? '→' : '←'}
              </Link>
              <h1 className="text-2xl font-bold">📆 {t('calendar')}</h1>
            </div>
            <Link 
              href={`/${locale}/settings`}
              className="px-4 py-2 bg-primary-700 rounded-lg font-medium hover:bg-primary-800 transition"
            >
              ⚙️ {t('settings')}
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Month Navigation */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={previousMonth}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
            >
              {locale === 'ar' ? '→' : '←'}
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
            >
              {locale === 'ar' ? '←' : '→'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">{tCommon('loading')}</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {dayNames.map((day, index) => (
                <div key={index} className="text-center font-semibold text-gray-700 p-2">
                  {day}
                </div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: startingDayOfWeek }).map((_, index) => (
                <div key={`empty-${index}`} className="p-2 min-h-[100px]"></div>
              ))}

              {/* Calendar days */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const date = new Date(year, month, day);
                const dateString = date.toDateString();
                const isToday = dateString === today;
                const dayJobs = jobsByDate[dateString] || [];

                return (
                  <div
                    key={day}
                    className={`p-2 min-h-[100px] border rounded-lg ${
                      isToday ? 'bg-sky-50 border-sky-500' : 'border-gray-200 hover:bg-gray-50'
                    } transition`}
                  >
                    <div className={`font-medium mb-1 ${isToday ? 'text-sky-600' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayJobs.slice(0, 3).map((job) => (
                        <Link
                          key={job.jobId}
                          href={`/${locale}/jobs/${job.jobId}`}
                          className="block text-xs bg-primary-100 text-primary-800 rounded px-2 py-1 hover:bg-primary-200 transition truncate"
                        >
                          {job.customerName}
                        </Link>
                      ))}
                      {dayJobs.length > 3 && (
                        <div className="text-xs text-gray-500 px-2">
                          +{dayJobs.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md">
            {tCommon('error')}: {error}
          </div>
        )}
      </main>
    </div>
  );
}

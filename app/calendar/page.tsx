'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
                href="/"
                className="text-2xl hover:opacity-80 transition"
              >
                ← 
              </Link>
              <h1 className="text-2xl font-bold">📆 Calendar</h1>
            </div>
            <Link 
              href="/"
              className="px-4 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              Today Board
            </Link>
          </div>
        </div>
      </header>

      {/* Calendar */}
      <main className="container mx-auto px-4 py-6">
        {/* Month Navigation */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={previousMonth}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              ← Previous
            </button>
            <h2 className="text-2xl font-bold text-gray-800">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}

            {/* Empty cells for days before month starts */}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square"></div>
            ))}

            {/* Calendar days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const dateString = date.toDateString();
              const dayJobs = jobsByDate[dateString] || [];
              const isToday = dateString === today;

              return (
                <div
                  key={day}
                  className={`aspect-square border rounded-lg p-2 ${
                    isToday ? 'bg-primary-50 border-primary-400 border-2' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary-600' : 'text-gray-700'}`}>
                    {day}
                  </div>
                  {dayJobs.length > 0 && (
                    <div className="space-y-1">
                      {dayJobs.slice(0, 3).map((job) => (
                        <Link
                          key={job.jobId}
                          href={`/jobs/${job.jobId}`}
                          className="block text-xs bg-blue-100 text-blue-800 rounded px-1 py-0.5 truncate hover:bg-blue-200 transition"
                          title={`${job.customerName} - ${job.serviceType}`}
                        >
                          {new Date(job.appointmentTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })} {job.customerName}
                        </Link>
                      ))}
                      {dayJobs.length > 3 && (
                        <div className="text-xs text-gray-500 font-semibold">
                          +{dayJobs.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Jobs List Below Calendar */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Upcoming Appointments</h3>
          
          {loading && (
            <div className="text-center py-8 text-gray-500">Loading jobs...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              Error: {error}
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="text-center py-8 text-gray-500">No appointments scheduled</div>
          )}

          {!loading && jobs.length > 0 && (
            <div className="space-y-3">
              {jobs
                .sort((a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime())
                .map((job) => (
                  <Link
                    key={job.jobId}
                    href={`/jobs/${job.jobId}`}
                    className="block border border-gray-200 rounded-lg p-4 hover:border-primary-400 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg text-gray-800">{job.customerName}</div>
                        <div className="text-sm text-gray-600">
                          {job.vehicleInfo?.year && job.vehicleInfo?.make ? (
                            `${job.vehicleInfo.year} ${job.vehicleInfo.make} ${job.vehicleInfo.model || ''}`
                          ) : (
                            'Vehicle info pending'
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{job.serviceType}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-700">
                          {new Date(job.appointmentTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(job.appointmentTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                        <div className={`text-xs mt-1 px-2 py-1 rounded ${
                          job.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'CHECKED_IN' ? 'bg-green-100 text-green-800' :
                          job.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                          job.status === 'WORK_COMPLETED' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {job.status.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

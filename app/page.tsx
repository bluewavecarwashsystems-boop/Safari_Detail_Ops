'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WorkStatus } from '../lib/types';

// Mock data for now - will be replaced with API calls
interface JobCard {
  jobId: string;
  customerName: string;
  vehicleInfo: string;
  serviceType: string;
  scheduledStart: string;
  workStatus: WorkStatus;
}

const mockJobs: JobCard[] = [
  {
    jobId: '1',
    customerName: 'John Doe',
    vehicleInfo: '2020 Tesla Model 3 - ABC123',
    serviceType: 'Full Detail',
    scheduledStart: '2026-02-05T09:00:00Z',
    workStatus: WorkStatus.SCHEDULED,
  },
  {
    jobId: '2',
    customerName: 'Jane Smith',
    vehicleInfo: '2019 Honda Accord - XYZ789',
    serviceType: 'Express Wash',
    scheduledStart: '2026-02-05T10:00:00Z',
    workStatus: WorkStatus.CHECKED_IN,
  },
];

const columns = [
  { status: WorkStatus.SCHEDULED, title: 'Scheduled', icon: '📅' },
  { status: WorkStatus.CHECKED_IN, title: 'Checked In', icon: '✅' },
  { status: WorkStatus.IN_PROGRESS, title: 'In Progress', icon: '🔧' },
  { status: WorkStatus.QC_READY, title: 'QC Ready', icon: '🔍' },
  { status: WorkStatus.WORK_COMPLETED, title: 'Work Done', icon: '✨' },
];

export default function TodayBoard() {
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // Map API jobs to UI format
          const formattedJobs: JobCard[] = data.data.jobs.map((job: any) => ({
            jobId: job.jobId,
            customerName: job.customerName || 'Unknown',
            vehicleInfo: job.vehicleInfo?.year && job.vehicleInfo?.make 
              ? `${job.vehicleInfo.year} ${job.vehicleInfo.make} ${job.vehicleInfo.model || ''} - ${job.vehicleInfo.licensePlate || ''}`.trim()
              : 'Vehicle info pending',
            serviceType: job.serviceType || 'Detail Service',
            scheduledStart: job.appointmentTime || job.createdAt,
            workStatus: job.status,
          }));
          setJobs(formattedJobs);
        } else {
          // Fallback to mock data if API fails
          console.warn('API returned no jobs, using mock data');
          setJobs(mockJobs);
        }
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
        setError((err as Error).message);
        // Fallback to mock data on error
        setJobs(mockJobs);
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-primary-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">🚗 Safari Detail Ops</h1>
            <div className="flex gap-4">
              <Link 
                href="/calendar"
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-gray-100 transition"
              >
                📆 Calendar
              </Link>
              <Link 
                href="/settings"
                className="px-4 py-2 bg-primary-700 rounded-lg font-medium hover:bg-primary-800 transition"
              >
                ⚙️ Settings
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="container mx-auto px-4 py-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Today's Board</h2>
          <p className="text-sm text-gray-600">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          {error && (
            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 rounded text-sm text-yellow-800">
              ⚠️ API Error: {error} (showing mock data)
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-2 text-gray-600">Loading jobs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {columns.map((column) => {
            const columnJobs = jobs.filter(job => job.workStatus === column.status);
            
            return (
              <div key={column.status} className="bg-white rounded-lg shadow-md p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                    <span>{column.icon}</span>
                    <span>{column.title}</span>
                    <span className="ml-auto text-sm bg-gray-200 px-2 py-1 rounded-full">
                      {columnJobs.length}
                    </span>
                  </h3>
                </div>

                <div className="space-y-3">
                  {columnJobs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No jobs
                    </div>
                  ) : (
                    columnJobs.map((job) => (
                      <Link
                        key={job.jobId}
                        href={`/jobs/${job.jobId}`}
                        className="block bg-gray-50 rounded-lg p-3 hover:bg-gray-100 border border-gray-200 transition"
                      >
                        <div className="font-medium text-gray-900">{job.customerName}</div>
                        <div className="text-sm text-gray-600 mt-1">{job.vehicleInfo}</div>
                        <div className="text-xs text-gray-500 mt-2">{job.serviceType}</div>
                        <div className="text-xs text-primary-600 mt-1">
                          {new Date(job.scheduledStart).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </div>
                      </Link>
                    ))
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

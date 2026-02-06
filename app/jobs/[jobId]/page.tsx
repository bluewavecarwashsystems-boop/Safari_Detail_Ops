'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { WorkStatus, PaymentStatus } from '../../../lib/types';

// Mock data - will be replaced with API call
const mockJob = {
  jobId: '1',
  customerName: 'John Doe',
  customerPhone: '+1 (615) 555-1234',
  customerEmail: 'john@example.com',
  vehicleInfo: {
    make: 'Tesla',
    model: 'Model 3',
    year: 2020,
    color: 'White',
    licensePlate: 'ABC123',
  },
  serviceType: 'Full Detail Package',
  scheduledStart: '2026-02-05T09:00:00Z',
  workStatus: WorkStatus.SCHEDULED,
  payment: {
    status: PaymentStatus.UNPAID,
    amountCents: 15000,
  },
  checklist: [
    { label: 'Vacuum interior', completed: false },
    { label: 'Clean windows', completed: false },
    { label: 'Wash exterior', completed: false },
    { label: 'Dry & detail', completed: false },
  ],
  checkinPhotos: [] as string[],
  checkinPhotosRequired: 4,
};

export default function JobDetail() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState(mockJob);

  const handleStatusChange = (newStatus: WorkStatus) => {
    setJob({ ...job, workStatus: newStatus });
    // TODO: API call to update status
  };

  const handleChecklistToggle = (index: number) => {
    const newChecklist = [...job.checklist];
    newChecklist[index].completed = !newChecklist[index].completed;
    setJob({ ...job, checklist: newChecklist });
    // TODO: API call to update checklist
  };

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
              <div className="font-medium">{job.customerPhone}</div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-600">Email</label>
              <div className="font-medium">{job.customerEmail}</div>
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
                {job.vehicleInfo.year} {job.vehicleInfo.make} {job.vehicleInfo.model}
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600">License Plate</label>
              <div className="font-medium">{job.vehicleInfo.licensePlate}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Color</label>
              <div className="font-medium">{job.vehicleInfo.color}</div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Service</label>
              <div className="font-medium">{job.serviceType}</div>
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
            {job.checklist.map((item, index) => (
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
            {job.checkinPhotos.length} of {job.checkinPhotosRequired} required photos uploaded
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
                ${(job.payment.amountCents / 100).toFixed(2)}
              </div>
            </div>
            <div>
              <span className={`px-4 py-2 rounded-lg font-medium ${
                job.payment.status === PaymentStatus.PAID
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {job.payment.status}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

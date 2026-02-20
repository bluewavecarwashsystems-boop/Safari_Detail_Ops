'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n/provider';
import type { Locale } from '@/i18n';

export default function PhoneBookingPage() {
  const t = useTranslations('manager.phoneBooking');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as Locale;

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehicleNotes: '',
    serviceName: 'Full Detail',
    serviceDuration: '90',
    serviceAmount: '',
    appointmentDate: '',
    appointmentTime: '',
    bookingNotes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customerName.trim()) {
      newErrors.customerName = t('requiredField');
    }
    if (!formData.customerPhone.trim()) {
      newErrors.customerPhone = t('requiredField');
    }
    if (!formData.serviceName.trim()) {
      newErrors.serviceName = t('requiredField');
    }
    if (!formData.serviceDuration || parseInt(formData.serviceDuration) <= 0) {
      newErrors.serviceDuration = t('requiredField');
    }
    if (!formData.appointmentDate) {
      newErrors.appointmentDate = t('requiredField');
    }
    if (!formData.appointmentTime) {
      newErrors.appointmentTime = t('requiredField');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setCreating(true);

    try {
      // Combine date and time into ISO timestamp
      const startAt = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`).toISOString();

      const requestBody = {
        customer: {
          name: formData.customerName,
          phone: formData.customerPhone,
          email: formData.customerEmail || undefined,
        },
        vehicle: {
          make: formData.vehicleMake || undefined,
          model: formData.vehicleModel || undefined,
          year: formData.vehicleYear ? parseInt(formData.vehicleYear) : undefined,
          color: formData.vehicleColor || undefined,
          notes: formData.vehicleNotes || undefined,
        },
        service: {
          serviceName: formData.serviceName,
          durationMinutes: parseInt(formData.serviceDuration),
          amountCents: formData.serviceAmount ? parseInt(formData.serviceAmount) * 100 : undefined,
        },
        appointmentTime: {
          startAt,
        },
        notes: formData.bookingNotes || undefined,
      };

      const response = await fetch('/api/manager/create-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create booking');
      }

      // Success!
      setCreatedJobId(data.data.jobId);
      setShowSuccess(true);
    } catch (error: any) {
      console.error('Failed to create booking:', error);
      alert(`${t('errorTitle')}: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAnother = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      vehicleColor: '',
      vehicleNotes: '',
      serviceName: 'Full Detail',
      serviceDuration: '90',
      serviceAmount: '',
      appointmentDate: '',
      appointmentTime: '',
      bookingNotes: '',
    });
    setErrors({});
    setShowSuccess(false);
    setCreatedJobId(null);
  };

  const handleViewJob = () => {
    if (createdJobId) {
      router.push(`/${locale}/jobs/${createdJobId}`);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-16 w-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('successTitle')}</h2>
            <p className="text-gray-600 mb-6">{t('successMessage')}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleViewJob}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('viewJob')}
              </button>
              <button
                onClick={handleCreateAnother}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('createAnother')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
          {/* Customer Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('customerSection')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('customerName')} *
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.customerName ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating}
                />
                {errors.customerName && (
                  <p className="mt-1 text-sm text-red-500">{errors.customerName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('customerPhone')} *
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.customerPhone ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating}
                />
                {errors.customerPhone && (
                  <p className="mt-1 text-sm text-red-500">{errors.customerPhone}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('customerEmail')}
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                />
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('vehicleSection')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vehicleMake')}
                </label>
                <input
                  type="text"
                  value={formData.vehicleMake}
                  onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vehicleModel')}
                </label>
                <input
                  type="text"
                  value={formData.vehicleModel}
                  onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vehicleYear')}
                </label>
                <input
                  type="number"
                  value={formData.vehicleYear}
                  onChange={(e) => setFormData({ ...formData, vehicleYear: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                  min="1900"
                  max="2100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vehicleColor')}
                </label>
                <input
                  type="text"
                  value={formData.vehicleColor}
                  onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('vehicleNotes')}
                </label>
                <textarea
                  value={formData.vehicleNotes}
                  onChange={(e) => setFormData({ ...formData, vehicleNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('serviceSection')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('serviceName')} *
                </label>
                <select
                  value={formData.serviceName}
                  onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.serviceName ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating}
                >
                  <option value="Full Detail">Full Detail</option>
                  <option value="Express Detail">Express Detail</option>
                  <option value="Interior Only">Interior Only</option>
                  <option value="Exterior Only">Exterior Only</option>
                  <option value="Basic Wash">Basic Wash</option>
                </select>
                {errors.serviceName && (
                  <p className="mt-1 text-sm text-red-500">{errors.serviceName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('serviceDuration')} *
                </label>
                <input
                  type="number"
                  value={formData.serviceDuration}
                  onChange={(e) => setFormData({ ...formData, serviceDuration: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.serviceDuration ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating}
                  min="15"
                  step="15"
                />
                {errors.serviceDuration && (
                  <p className="mt-1 text-sm text-red-500">{errors.serviceDuration}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('serviceAmount')}
                </label>
                <input
                  type="number"
                  value={formData.serviceAmount}
                  onChange={(e) => setFormData({ ...formData, serviceAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  disabled={creating}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Appointment Time */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('appointmentSection')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('appointmentDate')} *
                </label>
                <input
                  type="date"
                  value={formData.appointmentDate}
                  onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.appointmentDate ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating}
                />
                {errors.appointmentDate && (
                  <p className="mt-1 text-sm text-red-500">{errors.appointmentDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('appointmentTime')} *
                </label>
                <input
                  type="time"
                  value={formData.appointmentTime}
                  onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.appointmentTime ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating}
                />
                {errors.appointmentTime && (
                  <p className="mt-1 text-sm text-red-500">{errors.appointmentTime}</p>
                )}
              </div>
            </div>
          </div>

          {/* Booking Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('bookingNotes')}
            </label>
            <textarea
              value={formData.bookingNotes}
              onChange={(e) => setFormData({ ...formData, bookingNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              disabled={creating}
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? t('creating') : t('createButton')}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={creating}
              className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

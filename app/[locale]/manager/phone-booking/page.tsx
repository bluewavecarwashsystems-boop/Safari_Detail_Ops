'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from '@/lib/i18n/provider';
import type { Locale } from '@/i18n';

/**
 * PHONE BOOKING WITH ADD-ONS SUPPORT
 * 
 * - Base services: Square Booking Services (one required)
 * - Add-ons: Square Items in "Add-on's" category (multi-select optional)
 * - Location: L9ZMZD9TTTTZJ (enforced server-side)
 * - Orders: Add-ons stored as Square Order line items, linked to booking
 */

interface Service {
  id: string;
  itemId: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  priceMoney?: {
    amount: number;
    currency: string;
  };
  version: number;
}

interface Addon {
  id: string;
  itemId: string;
  name: string;
  description?: string;
  priceMoney?: {
    amount: number;
    currency: string;
  };
  version: number;
}

export default function PhoneBookingPage() {
  const t = useTranslations('manager.phoneBooking');
  const tCommon = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as Locale;

  const [services, setServices] = useState<Service[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehicleNotes: '',
    serviceName: '',
    serviceDuration: '',
    serviceAmount: '',
    appointmentDate: '',
    appointmentTime: '',
    bookingNotes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  // Fetch catalog (services + add-ons) on component mount
  useEffect(() => {
    async function fetchCatalog() {
      try {
        setLoadingCatalog(true);
        const response = await fetch('/api/phone-booking/catalog');
        
        console.log('[PHONE BOOKING CLIENT] Catalog API Response Status:', response.status);
        
        if (!response.ok) {
          throw new Error('Failed to fetch catalog');
        }
        
        const data = await response.json();
        
        console.log('[PHONE BOOKING CLIENT] Catalog loaded:', {
          servicesCount: data.data?.services?.length || 0,
          addonsCount: data.data?.addons?.length || 0,
        });
        
        if (data.success && data.data) {
          const fetchedServices = data.data.services || [];
          const fetchedAddons = data.data.addons || [];
          
          setServices(fetchedServices);
          setAddons(fetchedAddons);
          
          // Auto-select first service if available
          if (fetchedServices.length > 0) {
            const firstService = fetchedServices[0];
            setSelectedServiceId(firstService.id);
            setFormData(prev => ({
              ...prev,
              serviceName: firstService.name,
              serviceDuration: firstService.durationMinutes?.toString() || '60',
              serviceAmount: firstService.priceMoney ? (firstService.priceMoney.amount / 100).toString() : '',
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch catalog:', error);
        alert('Failed to load services and add-ons from Square. Please refresh the page.');
      } finally {
        setLoadingCatalog(false);
      }
    }

    fetchCatalog();
  }, []);

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setSelectedServiceId(serviceId);
      setFormData(prev => ({
        ...prev,
        serviceName: service.name,
        serviceDuration: service.durationMinutes?.toString() || prev.serviceDuration,
        serviceAmount: service.priceMoney ? (service.priceMoney.amount / 100).toString() : prev.serviceAmount,
      }));
    }
  };

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddonIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(addonId)) {
        newSet.delete(addonId);
      } else {
        newSet.add(addonId);
      }
      return newSet;
    });
  };

  const calculateTotalPrice = (): number => {
    const servicePrice = parseFloat(formData.serviceAmount) || 0;
    const addonsPrice = Array.from(selectedAddonIds).reduce((sum, addonId) => {
      const addon = addons.find(a => a.id === addonId);
      return sum + ((addon?.priceMoney?.amount || 0) / 100);
    }, 0);
    return servicePrice + addonsPrice;
  };

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
      // Get selected service details
      const selectedService = services.find(s => s.id === selectedServiceId);
      if (!selectedService) {
        throw new Error('Please select a service');
      }

      // DEFENSIVE: Ensure selected service is from the services list
      // (Server-side validation handles production filtering)
      const isValidService = services.some(s => s.id === selectedService.id);
      if (!isValidService) {
        console.error('[PHONE BOOKING] Invalid service selection', {
          serviceId: selectedService.id,
        });
        throw new Error('Selected service is not available');
      }

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
          serviceVariationId: selectedService.id,
          serviceVariationVersion: selectedService.version,
          durationMinutes: parseInt(formData.serviceDuration),
          amountCents: formData.serviceAmount ? parseInt(formData.serviceAmount) * 100 : undefined,
        },
        appointmentTime: {
          startAt,
        },
        notes: formData.bookingNotes || undefined,
        // Include add-on variation IDs
        addonItemVariationIds: Array.from(selectedAddonIds),
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
      serviceName: '',
      serviceDuration: '',
      serviceAmount: '',
      appointmentDate: '',
      appointmentTime: '',
      bookingNotes: '',
    });
    setSelectedAddonIds(new Set());
    setErrors({});
    setShowSuccess(false);
    setCreatedJobId(null);
    
    // Auto-select first service again
    if (services.length > 0) {
      const firstService = services[0];
      setSelectedServiceId(firstService.id);
      setFormData(prev => ({
        ...prev,
        serviceName: firstService.name,
        serviceDuration: firstService.durationMinutes?.toString() || '60',
        serviceAmount: firstService.priceMoney ? (firstService.priceMoney.amount / 100).toString() : '',
      }));
    }
  };

  const handleViewJob = () => {
    if (createdJobId) {
      router.push(`/${locale}/jobs/${createdJobId}`);
    }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen px-4 py-8" style={{ background: 'var(--sf-bg)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
            <div className="mb-4">
              <svg className="mx-auto h-16 w-16" style={{ color: 'var(--sf-green)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--sf-ink)' }}>{t('successTitle')}</h2>
            <p className="mb-6" style={{ color: 'var(--sf-muted)' }}>{t('successMessage')}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleViewJob}
                className="px-6 py-2 bg-[#F47C20] text-white rounded-xl hover:bg-[#DB6E1C] sf-button-transition"
              >
                {t('viewJob')}
              </button>
              <button
                onClick={handleCreateAnother}
                className="px-6 py-2 bg-white border border-[#E7E2D8] rounded-xl hover:bg-[#FAF6EF] sf-button-transition"
                style={{ color: 'var(--sf-ink)' }}
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
    <div className="min-h-screen px-4 py-8" style={{ background: 'var(--sf-bg)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Image src="/safari-logo.png" alt="Safari Car Wash" width={60} height={60} className="object-contain" />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--sf-ink)' }}>{t('title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 space-y-6" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
          {/* Customer Information */}
          <div>
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--sf-ink)' }}>{t('customerSection')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--sf-brown)' }}>
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
                  placeholder="555-123-4567 or +15551234567"
                />
                {errors.customerPhone && (
                  <p className="mt-1 text-sm text-red-500">{errors.customerPhone}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Enter 10-digit US number (will be auto-formatted)</p>
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
                  value={selectedServiceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-gray-900 ${errors.serviceName ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={creating || loadingCatalog}
                >
                  {loadingCatalog ? (
                    <option value="">Loading services...</option>
                  ) : services.length === 0 ? (
                    <option value="">No services available</option>
                  ) : (
                    services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                        {service.priceMoney && ` - $${(service.priceMoney.amount / 100).toFixed(2)}`}
                        {service.durationMinutes && ` (${service.durationMinutes} min)`}
                      </option>
                    ))
                  )}
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

          {/* Add-ons Selection */}
          {addons.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Add-ons (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {addons.map((addon) => (
                  <label
                    key={addon.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedAddonIds.has(addon.id)
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAddonIds.has(addon.id)}
                      onChange={() => handleAddonToggle(addon.id)}
                      disabled={creating || loadingCatalog}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-3 flex-1">
                      <span className="block font-medium text-gray-900">{addon.name}</span>
                      {addon.priceMoney && (
                        <span className="block text-sm text-gray-600">
                          ${(addon.priceMoney.amount / 100).toFixed(2)}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Price Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Price Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base Service:</span>
                <span className="font-medium text-gray-900">
                  ${parseFloat(formData.serviceAmount || '0').toFixed(2)}
                </span>
              </div>
              {selectedAddonIds.size > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Add-ons ({selectedAddonIds.size}):</span>
                  <span className="font-medium text-gray-900">
                    ${Array.from(selectedAddonIds).reduce((sum, addonId) => {
                      const addon = addons.find(a => a.id === addonId);
                      return sum + ((addon?.priceMoney?.amount || 0) / 100);
                    }, 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Estimated Total:</span>
                <span className="font-bold text-lg" style={{ color: 'var(--sf-orange)' }}>
                  ${calculateTotalPrice().toFixed(2)}
                </span>
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
              className="flex-1 px-6 py-3 bg-[#F47C20] text-white font-semibold rounded-xl hover:bg-[#DB6E1C] disabled:bg-gray-400 disabled:cursor-not-allowed sf-button-transition"
            >
              {creating ? t('creating') : t('createButton')}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={creating}
              className="px-6 py-3 bg-white border border-[#E7E2D8] font-semibold rounded-xl hover:bg-[#FAF6EF] disabled:bg-gray-100 disabled:cursor-not-allowed sf-button-transition"
              style={{ color: 'var(--sf-ink)' }}
            >
              {tCommon('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

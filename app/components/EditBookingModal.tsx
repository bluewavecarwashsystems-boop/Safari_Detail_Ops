'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/lib/i18n/provider';

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

interface EditBookingModalProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditBookingModal({
  bookingId,
  isOpen,
  onClose,
  onSuccess,
}: EditBookingModalProps) {
  const t = useTranslations('job');
  const tCommon = useTranslations('common');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Current booking state
  const [currentService, setCurrentService] = useState<string>('');
  const [currentServiceVersion, setCurrentServiceVersion] = useState<number>(0);
  const [currentStartTime, setCurrentStartTime] = useState<string>('');
  const [currentDuration, setCurrentDuration] = useState<number>(60);
  const [teamMemberId, setTeamMemberId] = useState<string | undefined>();
  const [bookingVersion, setBookingVersion] = useState<number>(0);

  // Form state
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedServiceVersion, setSelectedServiceVersion] = useState<number>(0);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [startTime, setStartTime] = useState<string>('');
  const [suggestedTimes, setSuggestedTimes] = useState<string[]>([]);
  
  // Available services
  const [services, setServices] = useState<Service[]>([]);

  // Load initial data
  useEffect(() => {
    if (isOpen && bookingId) {
      loadEditOptions();
    }
  }, [isOpen, bookingId]);

  const loadEditOptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/bookings/edit-options?bookingId=${bookingId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to load edit options');
      }

      const { currentBooking, availableServices } = data.data;

      // Set current booking state
      setCurrentService(currentBooking.serviceVariationId);
      setCurrentServiceVersion(currentBooking.serviceVariationVersion);
      setCurrentStartTime(currentBooking.startAt);
      setCurrentDuration(currentBooking.durationMinutes);
      setTeamMemberId(currentBooking.teamMemberId);
      setBookingVersion(currentBooking.version);

      // Set form state to current values
      setSelectedService(currentBooking.serviceVariationId);
      setSelectedServiceVersion(currentBooking.serviceVariationVersion);
      setSelectedDuration(currentBooking.durationMinutes);
      setStartTime(currentBooking.startAt);

      // Set available services
      setServices(availableServices);

    } catch (err: any) {
      console.error('Load edit options error:', err);
      setError(err.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setSelectedService(serviceId);
      setSelectedServiceVersion(service.version);
      setSelectedDuration(service.durationMinutes || 60);
      setAvailabilityError(null);
      setSuggestedTimes([]);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setStartTime(newTime);
    setAvailabilityError(null);
    setSuggestedTimes([]);
  };

  const checkAvailability = async () => {
    if (!selectedService || !startTime) {
      return;
    }

    // Don't check if nothing changed
    if (selectedService === currentService && startTime === currentStartTime) {
      return;
    }

    try {
      setCheckingAvailability(true);
      setAvailabilityError(null);
      setSuggestedTimes([]);

      const response = await fetch('/api/bookings/check-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          serviceVariationId: selectedService,
          serviceVariationVersion: selectedServiceVersion,
          startAt: startTime,
          durationMinutes: selectedDuration,
          teamMemberId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Availability check failed');
      }

      if (!data.data.available) {
        setAvailabilityError('Selected time slot is not available');
        setSuggestedTimes(data.data.suggestedStartTimes || []);
      }

    } catch (err: any) {
      console.error('Availability check error:', err);
      setAvailabilityError(err.message || 'Failed to check availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSave = async () => {
    // Validate
    if (!selectedService || !startTime) {
      setError('Please select a service and start time');
      return;
    }

    // Check if anything actually changed
    if (selectedService === currentService && startTime === currentStartTime) {
      setError('No changes to save');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Final availability check before saving
      await checkAvailability();
      
      if (availabilityError) {
        setError('Cannot save: selected time slot is not available');
        return;
      }

      // Update booking
      const response = await fetch(`/api/bookings/${bookingId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceVariationId: selectedService,
          serviceVariationVersion: selectedServiceVersion,
          startAt: startTime,
          durationMinutes: selectedDuration,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to update booking');
      }

      // Success!
      onSuccess();
      onClose();

    } catch (err: any) {
      console.error('Save booking error:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const formatPrice = (cents?: number) => {
    if (!cents) return 'N/A';
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Edit Booking
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            disabled={saving}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={saving}
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {formatPrice(service.priceMoney?.amount)} ({service.durationMinutes} min)
                    </option>
                  ))}
                </select>
                {selectedService !== currentService && (
                  <p className="mt-1 text-sm text-blue-600">
                    ⚠️ Service will change from current selection
                  </p>
                )}
              </div>

              {/* Date & Time Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime.slice(0, 16)} // Format for datetime-local input
                  onChange={(e) => handleTimeChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  onBlur={checkAvailability}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={saving}
                />
                {startTime !== currentStartTime && (
                  <p className="mt-1 text-sm text-blue-600">
                    Current: {formatDateTime(currentStartTime)} → New: {formatDateTime(startTime)}
                  </p>
                )}
              </div>

              {/* Availability Check Status */}
              {checkingAvailability && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">Checking availability...</p>
                </div>
              )}

              {/* Availability Error & Suggestions */}
              {availabilityError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-yellow-800 mb-2">
                    {availabilityError}
                  </p>
                  {suggestedTimes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-yellow-700 mb-2">Suggested times:</p>
                      <div className="space-y-1">
                        {suggestedTimes.map((time) => (
                          <button
                            key={time}
                            onClick={() => handleTimeChange(time)}
                           className="block w-full text-left px-3 py-2 text-sm bg-white border border-yellow-300 rounded hover:bg-yellow-50"
                          >
                            {formatDateTime(time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Duration Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <strong>Duration:</strong> {selectedDuration} minutes
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Duration is determined by the selected service
                </p>
              </div>

              {/* Add-ons Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Add-ons will remain unchanged. To modify add-ons, use the add-ons editor separately.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !!availabilityError}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

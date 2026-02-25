/**
 * Checklist Templates Management Page
 * 
 * Manager-only page to edit TECH and QC checklist templates per service.
 * Features:
 * - Add/edit/delete checklist items
 * - Drag-and-drop reordering (placeholder - needs dnd-kit integration)
 * - Toggle required flag
 * - Version tracking
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ManagerLayout } from '@/app/components/ManagerLayout';
import type {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistType,
  ApiResponse,
  GetTemplatesResponse,
  AddTemplateItemResponse,
  UpdateTemplateItemResponse,
  DeleteTemplateItemResponse,
  ReorderTemplateItemsResponse,
} from '@/lib/types';

interface ServiceTypeResponse {
  serviceTypes: string[];
}

type TabType = 'TECH' | 'QC';

export default function ChecklistTemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Service types from Square
  const [availableServiceTypes, setAvailableServiceTypes] = useState<string[]>([]);
  
  // Service selection
  const [serviceType, setServiceType] = useState('');
  const [customServiceType, setCustomServiceType] = useState('');
  const [useCustomServiceType, setUseCustomServiceType] = useState(false);

  // Templates
  const [techTemplate, setTechTemplate] = useState<ChecklistTemplate | null>(null);
  const [qcTemplate, setQcTemplate] = useState<ChecklistTemplate | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('TECH');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Load service types from Square on mount
  useEffect(() => {
    loadServiceTypes();
  }, []);

  // Load templates when service type changes
  useEffect(() => {
    if (serviceType || (useCustomServiceType && customServiceType)) {
      loadTemplates();
    }
  }, [serviceType, customServiceType, useCustomServiceType]);

  const loadServiceTypes = async () => {
    setLoadingServices(true);
    try {
      const response = await fetch('/api/services');
      const data: ApiResponse<ServiceTypeResponse> = await response.json();

      if (response.ok && data.success && data.data) {
        // Services are already filtered by location in the API
        const serviceTypes = data.data.serviceTypes;
        
        setAvailableServiceTypes(serviceTypes);
        
        // Set first service as default if available
        if (serviceTypes.length > 0 && !serviceType) {
          setServiceType(serviceTypes[0]);
        }
      } else {
        console.error('Failed to load service types:', data.error?.message);
        // Fallback to empty array
        setAvailableServiceTypes([]);
      }
    } catch (err) {
      console.error('Load service types error:', err);
      setAvailableServiceTypes([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const getEffectiveServiceType = () => {
    return useCustomServiceType && customServiceType.trim()
      ? customServiceType.trim()
      : serviceType;
  };

  const loadTemplates = async () => {
    const effectiveServiceType = getEffectiveServiceType();
    if (!effectiveServiceType) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(
        `/api/services/${encodeURIComponent(effectiveServiceType)}/templates`
      );
      const data: ApiResponse<GetTemplatesResponse> = await response.json();

      if (response.ok && data.success && data.data) {
        setTechTemplate(data.data.templates.TECH || null);
        setQcTemplate(data.data.templates.QC || null);
      } else {
        setError(data.error?.message || 'Failed to load templates');
      }
    } catch (err) {
      console.error('Load templates error:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTemplate = (): ChecklistTemplate | null => {
    return activeTab === 'TECH' ? techTemplate : qcTemplate;
  };

  const getActiveItems = (): ChecklistTemplateItem[] => {
    const template = getCurrentTemplate();
    return template?.items.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder) || [];
  };

  const handleAddItem = async () => {
    if (!newItemLabel.trim()) return;

    setAddingItem(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/templates/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: getEffectiveServiceType(),
          type: activeTab,
          label: newItemLabel.trim(),
          isRequired: false,
        }),
      });

      const data: ApiResponse<AddTemplateItemResponse> = await response.json();

      if (response.ok && data.success && data.data) {
        if (activeTab === 'TECH') {
          setTechTemplate(data.data.template);
        } else {
          setQcTemplate(data.data.template);
        }
        setNewItemLabel('');
        setSuccess('Item added successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error?.message || 'Failed to add item');
      }
    } catch (err) {
      console.error('Add item error:', err);
      setError('Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleUpdateItem = async (itemId: string, label: string) => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/templates/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: getEffectiveServiceType(),
          type: activeTab,
          itemId,
          label: label.trim(),
        }),
      });

      const data: ApiResponse<UpdateTemplateItemResponse> = await response.json();

      if (response.ok && data.success && data.data) {
        if (activeTab === 'TECH') {
          setTechTemplate(data.data.template);
        } else {
          setQcTemplate(data.data.template);
        }
        setEditingItemId(null);
        setEditingLabel('');
        setSuccess('Item updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error?.message || 'Failed to update item');
      }
    } catch (err) {
      console.error('Update item error:', err);
      setError('Failed to update item');
    }
  };

  const handleToggleRequired = async (itemId: string, currentRequired: boolean) => {
    setError('');

    try {
      const response = await fetch(`/api/templates/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: getEffectiveServiceType(),
          type: activeTab,
          itemId,
          isRequired: !currentRequired,
        }),
      });

      const data: ApiResponse<UpdateTemplateItemResponse> = await response.json();

      if (response.ok && data.success && data.data) {
        if (activeTab === 'TECH') {
          setTechTemplate(data.data.template);
        } else {
          setQcTemplate(data.data.template);
        }
      } else {
        setError(data.error?.message || 'Failed to toggle required');
      }
    } catch (err) {
      console.error('Toggle required error:', err);
      setError('Failed to toggle required');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item? It will be soft-deleted (hidden).')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/templates/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: getEffectiveServiceType(),
          type: activeTab,
          itemId,
        }),
      });

      const data: ApiResponse<DeleteTemplateItemResponse> = await response.json();

      if (response.ok && data.success && data.data) {
        if (activeTab === 'TECH') {
          setTechTemplate(data.data.template);
        } else {
          setQcTemplate(data.data.template);
        }
        setSuccess('Item deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error?.message || 'Failed to delete item');
      }
    } catch (err) {
      console.error('Delete item error:', err);
      setError('Failed to delete item');
    }
  };

  const startEditing = (item: ChecklistTemplateItem) => {
    setEditingItemId(item.id);
    setEditingLabel(item.label);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingLabel('');
  };

  return (
    <ManagerLayout 
      title="Checklist Templates"
      subtitle="Manage TECH and QC checklists per service"
    >
      <div className="max-w-6xl mx-auto">

        {loadingServices && (
          <div className="mb-6 text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-sky-500"></div>
            <p className="mt-2 text-sm text-gray-600">Loading services from Square...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        {/* Service Type Selection */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Service Type</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Common Service Types
              </label>
              <select
                value={serviceType}
                onChange={(e) => {
                  setServiceType(e.target.value);
                  setUseCustomServiceType(false);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">-- Select a service type --</option>
                {availableServiceTypes.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={useCustomServiceType}
                  onChange={(e) => setUseCustomServiceType(e.target.checked)}
                  className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-sm font-medium text-gray-700">Use custom service type (not in Square)</span>
              </label>
              <input
                type="text"
                value={customServiceType}
                onChange={(e) => setCustomServiceType(e.target.value)}
                disabled={!useCustomServiceType}
                placeholder="Enter custom service type..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100 text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {getEffectiveServiceType() && (
              <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-md">
                <strong>Current Service:</strong> {getEffectiveServiceType()}
              </div>
            )}
          </div>
        </div>

        {/* Templates Editor */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('TECH')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'TECH'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                TECH Checklist
                {techTemplate && (
                  <span className="ml-2 text-xs text-gray-500">
                    (v{techTemplate.version}, {getActiveItems().length} items)
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('QC')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === 'QC'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                QC Checklist
                {qcTemplate && (
                  <span className="ml-2 text-xs text-gray-500">
                    (v{qcTemplate.version}, {getActiveItems().length} items)
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-sky-500"></div>
                <p className="mt-4 text-gray-600">Loading templates...</p>
              </div>
            ) : (
              <>
                {/* Add New Item */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItemLabel}
                      onChange={(e) => setNewItemLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddItem();
                      }}
                      placeholder={`Add new ${activeTab} checklist item...`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                      onClick={handleAddItem}
                      disabled={!newItemLabel.trim() || addingItem}
                      className="px-4 py-2 bg-sky-500 text-white rounded-md hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center gap-2"
                    >
                      {addingItem ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      Add Item
                    </button>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {getActiveItems().length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg mb-2">No items yet</p>
                      <p className="text-sm">Add your first checklist item above</p>
                    </div>
                  ) : (
                    getActiveItems().map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-md hover:border-gray-300 transition"
                      >
                        {/* Drag Handle (placeholder) */}
                        <div className="text-gray-400 cursor-move">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
                          </svg>
                        </div>

                        {/* Item Number */}
                        <div className="w-8 text-center text-sm font-medium text-gray-500">
                          {index + 1}
                        </div>

                        {/* Label */}
                        {editingItemId === item.id ? (
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateItem(item.id, editingLabel);
                              if (e.key === 'Escape') cancelEditing();
                            }}
                            className="flex-1 px-2 py-1 border border-sky-500 rounded focus:ring-sky-500 focus:border-sky-500 text-gray-900 placeholder:text-gray-400"
                            autoFocus
                          />
                        ) : (
                          <div className="flex-1 text-gray-900">
                            {item.label}
                            {item.isRequired && (
                              <span className="ml-2 text-xs text-red-500 font-semibold">*Required</span>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {editingItemId === item.id ? (
                            <>
                              <button
                                onClick={() => handleUpdateItem(item.id, editingLabel)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition"
                                title="Save"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded transition"
                                title="Cancel"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(item)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Edit"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleToggleRequired(item.id, item.isRequired)}
                                className={`p-2 rounded transition ${
                                  item.isRequired
                                    ? 'text-red-600 hover:bg-red-50'
                                    : 'text-gray-400 hover:bg-gray-50'
                                }`}
                                title={item.isRequired ? 'Mark as optional' : 'Mark as required'}
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                                title="Delete"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Template Info */}
                {getCurrentTemplate() && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-500 space-y-1">
                      <p><strong>Template ID:</strong> {getCurrentTemplate()?.templateId}</p>
                      <p><strong>Version:</strong> {getCurrentTemplate()?.version}</p>
                      <p><strong>Last Updated:</strong> {getCurrentTemplate()?.updatedAt ? new Date(getCurrentTemplate()!.updatedAt).toLocaleString() : 'N/A'}</p>
                      {getCurrentTemplate()?.updatedBy && (
                        <p><strong>Updated By:</strong> {getCurrentTemplate()!.updatedBy!.name} ({getCurrentTemplate()!.updatedBy!.role})</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Service types are loaded from your Square catalog</strong></li>
            <li>Templates are automatically created when you add the first item</li>
            <li>Changes to templates do NOT affect existing jobs</li>
            <li>New jobs will snapshot the template at check-in time</li>
            <li>Drag-and-drop reordering coming soon (use edit for now)</li>
            <li>Deleted items are soft-deleted (hidden, not removed)</li>
            <li>Star icon marks items as required</li>
          </ul>
        </div>
      </div>
    </ManagerLayout>
  );
}

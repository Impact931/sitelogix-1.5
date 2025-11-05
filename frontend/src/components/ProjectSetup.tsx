import React, { useState } from 'react';

interface Project {
  id: string;
  name: string;
  location: string;
  budget: number;
  details: string;
  status: 'planning' | 'active' | 'on-hold' | 'complete';
  startDate: string;
  endDate: string;
  teamMembers: string[];
}

interface ProjectSetupProps {
  userRole?: 'admin' | 'manager' | 'user';
  onBack?: () => void;
  onProjectCreated?: () => void;
}

const ProjectSetup: React.FC<ProjectSetupProps> = ({ userRole = 'manager', onBack, onProjectCreated: _onProjectCreated }) => {
  const [formData, setFormData] = useState<Omit<Project, 'id'>>({
    name: '',
    location: '',
    budget: 0,
    details: '',
    status: 'planning',
    startDate: '',
    endDate: '',
    teamMembers: []
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof formData, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Mock team members list
  const availableTeamMembers = [
    { id: 'emp_001', name: 'John Martinez' },
    { id: 'emp_002', name: 'Sarah Johnson' },
    { id: 'emp_003', name: 'Mike Chen' },
    { id: 'emp_004', name: 'Emily Rodriguez' }
  ];

  // Check if user has manager+ access
  const hasAccess = userRole === 'admin' || userRole === 'manager';

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleTeamMemberToggle = (memberId: string) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(memberId)
        ? prev.teamMembers.filter(id => id !== memberId)
        : [...prev.teamMembers, memberId]
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof typeof formData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }
    if (formData.budget <= 0) {
      newErrors.budget = 'Budget must be greater than 0';
    }
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock save logic
    const project: Project = {
      ...formData,
      id: `proj_${Date.now()}`
    };

    console.log('Saving project:', project);

    setIsSaving(false);
    setSaveSuccess(true);

    // Reset form after 2 seconds
    setTimeout(() => {
      setFormData({
        name: '',
        location: '',
        budget: 0,
        details: '',
        status: 'planning',
        startDate: '',
        endDate: '',
        teamMembers: []
      });
      setSaveSuccess(false);
    }, 2000);
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      onBack?.();
    }
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'planning': return 'bg-blue-500/20 text-blue-400';
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'on-hold': return 'bg-yellow-500/20 text-yellow-400';
      case 'complete': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="glass-gold rounded-2xl p-8 max-w-md text-center border border-red-500/30">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">Only managers and administrators can create new projects.</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">New Project Setup</h1>
              <p className="text-gray-400 text-sm mt-1 font-medium">
                Create and configure a new construction project
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
            >
              Back
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 glass rounded-2xl p-4 border border-green-500/30 bg-green-500/10">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-green-400 font-medium">Project saved successfully!</p>
            </div>
          </div>
        )}

        {/* Project Form */}
        <div className="glass rounded-2xl p-8 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-300 mb-2">
                  Project Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.name ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition`}
                  placeholder="e.g., Downtown Office Complex"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-semibold text-gray-300 mb-2">
                  Location <span className="text-red-400">*</span>
                </label>
                <input
                  id="location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.location ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition`}
                  placeholder="e.g., 123 Main St, San Francisco, CA"
                />
                {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location}</p>}
              </div>

              {/* Budget */}
              <div>
                <label htmlFor="budget" className="block text-sm font-semibold text-gray-300 mb-2">
                  Budget ($) <span className="text-red-400">*</span>
                </label>
                <input
                  id="budget"
                  type="number"
                  value={formData.budget || ''}
                  onChange={(e) => handleInputChange('budget', parseFloat(e.target.value) || 0)}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.budget ? 'border-red-500' : 'border-white/10'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition`}
                  placeholder="e.g., 2500000"
                />
                {errors.budget && <p className="text-red-400 text-xs mt-1">{errors.budget}</p>}
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-semibold text-gray-300 mb-2">
                  Status <span className="text-red-400">*</span>
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
                >
                  <option value="planning" className="bg-dark-bg">Planning</option>
                  <option value="active" className="bg-dark-bg">Active</option>
                  <option value="on-hold" className="bg-dark-bg">On Hold</option>
                  <option value="complete" className="bg-dark-bg">Complete</option>
                </select>
                <div className="mt-2">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(formData.status)}`}>
                    {formData.status.replace('-', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-4">Timeline</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-sm font-semibold text-gray-300 mb-2">
                  Start Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.startDate ? 'border-red-500' : 'border-white/10'} rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition`}
                />
                {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate}</p>}
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-sm font-semibold text-gray-300 mb-2">
                  End Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className={`w-full px-4 py-3 bg-white/5 border ${errors.endDate ? 'border-red-500' : 'border-white/10'} rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition`}
                />
                {errors.endDate && <p className="text-red-400 text-xs mt-1">{errors.endDate}</p>}
              </div>
            </div>

            {/* Duration Display */}
            {formData.startDate && formData.endDate && formData.startDate <= formData.endDate && (
              <div className="mt-4 p-3 bg-gold/10 rounded-xl border border-gold/20">
                <p className="text-sm text-white">
                  Project duration: {
                    Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))
                  } days
                </p>
              </div>
            )}
          </div>

          {/* Project Details */}
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-4">Project Details</h2>
            <textarea
              value={formData.details}
              onChange={(e) => handleInputChange('details', e.target.value)}
              rows={6}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition resize-none"
              placeholder="Enter project description, scope, requirements, and any additional details..."
            />
          </div>

          {/* Team Assignment */}
          <div>
            <h2 className="text-xl font-display font-bold text-white mb-4">Team Members</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableTeamMembers.map((member) => (
                <div
                  key={member.id}
                  onClick={() => handleTeamMemberToggle(member.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    formData.teamMembers.includes(member.id)
                      ? 'bg-gold/10 border-gold/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      formData.teamMembers.includes(member.id)
                        ? 'border-gold bg-gold'
                        : 'border-white/30'
                    }`}>
                      {formData.teamMembers.includes(member.id) && (
                        <svg className="w-3 h-3 text-dark-bg" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
                    </div>
                    <p className="text-white font-medium text-sm">{member.name}</p>
                  </div>
                </div>
              ))}
            </div>
            {formData.teamMembers.length > 0 && (
              <div className="mt-3 p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                <p className="text-sm text-green-400">
                  {formData.teamMembers.length} team member{formData.teamMembers.length !== 1 ? 's' : ''} assigned
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-6 py-3 glass rounded-xl text-white hover:bg-white/10 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Project</span>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectSetup;

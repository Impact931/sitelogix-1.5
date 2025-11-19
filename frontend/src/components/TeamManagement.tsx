import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface TeamMember {
  personId: string;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  preferredName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  hourlyRate?: number;
  overtimeRate?: number;
  doubleTimeRate?: number;
  employmentStatus?: string;
  hireDate?: string;
  // Login/Access fields
  username?: string;
  role?: string;
}

interface TeamManagementProps {
  onClose: () => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ onClose }) => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [filteredTeam, setFilteredTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState<Partial<TeamMember>>({});
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchTeam();
  }, [statusFilter]);

  useEffect(() => {
    filterTeam();
  }, [team, searchTerm, statusFilter]);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/personnel?status=${statusFilter}&limit=1000`);
      const data = await response.json();

      if (data.success) {
        const members = (data.personnel || data.data?.employees || data.employees || [])
          .map((emp: any) => {
            const firstName = emp.firstName || emp.first_name || '';
            const lastName = emp.lastName || emp.last_name || '';
            const preferredName = emp.preferredName || emp.preferred_name || '';

            // Build fullName with fallbacks
            let fullName = emp.fullName || emp.full_name;
            if (!fullName && firstName && lastName) {
              fullName = `${firstName} ${lastName}`.trim();
            } else if (!fullName && preferredName) {
              fullName = preferredName;
            } else if (!fullName) {
              fullName = 'undefined undefined';  // Mark for filtering
            }

            return {
              personId: emp.personId,
              employeeNumber: emp.employeeNumber || emp.employee_number,
              firstName,
              lastName,
              fullName,
              preferredName,
              email: emp.email,
              phone: emp.phone,
              jobTitle: emp.jobTitle || emp.position,
              hourlyRate: emp.hourlyRate || emp.hourly_rate,
              overtimeRate: emp.overtimeRate || emp.overtime_rate,
              doubleTimeRate: emp.doubleTimeRate || emp.double_time_rate,
              employmentStatus: emp.employmentStatus || emp.employment_status,
              hireDate: emp.hireDate || emp.hire_date,
              username: emp.username,
              role: emp.role || 'employee'  // Default to employee if no role set
            };
          })
          .filter((member: TeamMember) => member.fullName !== 'undefined undefined');  // Filter out incomplete records
        setTeam(members);
      } else {
        setError(data.error || 'Failed to fetch team members');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team members');
    } finally {
      setLoading(false);
    }
  };

  const filterTeam = () => {
    let filtered = [...team];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(member =>
        member.firstName?.toLowerCase().includes(term) ||
        member.lastName?.toLowerCase().includes(term) ||
        member.employeeNumber?.toLowerCase().includes(term) ||
        member.email?.toLowerCase().includes(term) ||
        member.role?.toLowerCase().includes(term) ||
        member.preferredName?.toLowerCase().includes(term)
      );
    }

    setFilteredTeam(filtered);
  };

  const handleAdd = () => {
    setFormData({
      employmentStatus: 'active',
      role: 'employee'  // Default to employee
    });
    setNewPassword('');
    setShowAddModal(true);
  };

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member);
    setFormData({ ...member });
    setNewPassword('');
    setShowEditModal(true);
  };

  const handleSaveNew = async () => {
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.preferredName?.trim()) {
      alert('First name, last name, and preferred name (nickname for Roxy) are required');
      return;
    }

    // Validate login credentials for non-employee roles
    if (formData.role && formData.role !== 'employee') {
      if (!formData.email?.trim()) {
        alert('Email is required for users with app login access');
        return;
      }
      if (!newPassword) {
        alert('Password is required for new users with app login access');
        return;
      }
    }

    try {
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        preferredName: formData.preferredName,
        employeeNumber: formData.employeeNumber,
        email: formData.email,
        phone: formData.phone,
        jobTitle: formData.jobTitle,
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate.toString()) : undefined,
        employmentStatus: formData.employmentStatus || 'active',
        hireDate: formData.hireDate,
        role: formData.role || 'employee'
      };

      // Add login credentials for non-employee roles (foreman, manager, admin)
      if (formData.role && formData.role !== 'employee') {
        payload.username = formData.email; // Use email as username
        payload.password = newPassword;
      }

      console.log('Creating new employee:', payload);

      const response = await fetch(`${API_BASE_URL}/personnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('Employee created successfully');
        setShowAddModal(false);
        setNewPassword('');
        fetchTeam();
      } else {
        console.error('Failed to create employee:', result.error);
        alert(result.error || 'Failed to add team member');
      }
    } catch (err) {
      console.error('Error creating employee:', err);
      alert('Failed to add team member: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMember || !selectedMember.personId) {
      console.error('No selected member or missing personId');
      alert('Error: Unable to identify the employee to update');
      return;
    }

    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.preferredName?.trim()) {
      alert('First name, last name, and preferred name are required');
      return;
    }

    // Validate login credentials for non-employee roles
    if (formData.role && formData.role !== 'employee') {
      if (!formData.email?.trim()) {
        alert('Email is required for users with app login access');
        return;
      }
    }

    try {
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        preferredName: formData.preferredName,
        employeeNumber: formData.employeeNumber,
        email: formData.email,
        phone: formData.phone,
        jobTitle: formData.jobTitle,
        hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate.toString()) : undefined,
        employmentStatus: formData.employmentStatus,
        hireDate: formData.hireDate,
        role: formData.role
      };

      // Set username to email for non-employee roles (foreman, manager, admin)
      if (formData.role && formData.role !== 'employee') {
        payload.username = formData.email;
        if (newPassword) {
          payload.password = newPassword;
        }
      } else {
        // Employee role - no login access
        payload.username = null;
        payload.role = 'employee';
      }

      console.log('Updating employee:', selectedMember.personId, payload);

      // URL-encode the personId to handle special characters like #
      const encodedPersonId = encodeURIComponent(selectedMember.personId);
      const response = await fetch(`${API_BASE_URL}/personnel/${encodedPersonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        setShowEditModal(false);
        setSelectedMember(null);
        setNewPassword('');
        fetchTeam();
      } else {
        alert(result.error || 'Failed to update team member');
      }
    } catch (err) {
      console.error('Error updating employee:', err);
      alert('Failed to update team member: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (!member || !member.personId) {
      console.error('Invalid member data for deletion');
      alert('Error: Unable to identify the employee to terminate');
      return;
    }

    if (!confirm(`Are you sure you want to terminate ${member.fullName}?`)) return;

    try {
      console.log('Terminating employee:', member.personId);

      // URL-encode the personId to handle special characters like #
      const encodedPersonId = encodeURIComponent(member.personId);
      const response = await fetch(`${API_BASE_URL}/personnel/${encodedPersonId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminationDate: new Date().toISOString().split('T')[0],
          reason: 'Terminated via Team Management'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('Employee terminated successfully');
        fetchTeam();
      } else {
        console.error('Failed to terminate employee:', result.error);
        alert(result.error || 'Failed to terminate team member');
      }
    } catch (err) {
      console.error('Error terminating employee:', err);
      alert('Failed to terminate team member: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-gold-light to-gold-dark w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-gold/20">
                <svg className="w-7 h-7 text-dark-bg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white">Team Management</h1>
                <p className="text-xs text-gray-400">Personnel & Access Control</p>
              </div>
            </div>

            {/* Back Button */}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white text-sm font-medium transition flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="glass rounded-xl p-6 border border-white/10">
          <div className="flex gap-4 flex-wrap">
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[300px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
            >
              <option value="active" className="bg-dark-card text-white">Active</option>
              <option value="healthy" className="bg-dark-card text-white">Healthy</option>
              <option value="injured" className="bg-dark-card text-white">Injured</option>
              <option value="on-leave" className="bg-dark-card text-white">On Leave</option>
              <option value="inactive" className="bg-dark-card text-white">Inactive</option>
              <option value="all" className="bg-dark-card text-white">All</option>
              <option value="terminated" className="bg-dark-card text-white">Terminated</option>
            </select>
            <button
              onClick={handleAdd}
              className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg font-semibold rounded-lg hover:shadow-lg hover:shadow-gold/20 transition-all duration-300"
            >
              + Add Team Member
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
              <p className="mt-4">Loading team members...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">{error}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Employee #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nickname</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredTeam.map((member) => (
                      <tr key={member.personId} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-white">{member.fullName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {member.employeeNumber || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {member.preferredName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="text-gray-300">{member.email || '-'}</div>
                          <div className="text-gray-400">{member.phone || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            member.role === 'admin' || member.role === 'superadmin' ? 'bg-gold/20 text-gold' :
                            member.role === 'foreman' ? 'bg-blue-500/20 text-blue-400' :
                            member.role === 'manager' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Employee'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            member.employmentStatus === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            member.employmentStatus === 'healthy' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            member.employmentStatus === 'injured' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            member.employmentStatus === 'on-leave' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                            member.employmentStatus === 'inactive' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {member.employmentStatus || 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          ${member.hourlyRate?.toFixed(2) || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {member.role && member.role !== 'employee' ? (
                            <div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                {member.role}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">No Access</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleEdit(member)}
                            className="text-gold hover:text-gold-light transition-colors font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(member)}
                            className="text-red-400 hover:text-red-300 transition-colors font-medium"
                          >
                            Terminate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="px-6 py-3 bg-white/5 border-t border-white/10 text-sm text-gray-400">
                Showing {filteredTeam.length} of {team.length} team members
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {showAddModal ? 'Add Team Member' : 'Edit Team Member'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Profile Information */}
              <div className="border-b border-white/10 pb-4">
                <h4 className="font-semibold mb-3 text-white">Profile Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Employee Number
                    </label>
                    <input
                      type="text"
                      value={formData.employeeNumber || ''}
                      onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                      placeholder="e.g., PKW01, IC101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Nickname for Roxy * <span className="text-xs text-gray-400">(How Roxy identifies them)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.preferredName || ''}
                      onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                      placeholder="e.g., Bob, Mike, Sarah"
                    />
                  </div>
                  {/* Job Title field removed - use Role dropdown below instead */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Employment Status
                    </label>
                    <select
                      value={formData.employmentStatus || 'active'}
                      onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    >
                      <option value="active" className="bg-dark-card text-white">Active</option>
                      <option value="healthy" className="bg-dark-card text-white">Healthy</option>
                      <option value="injured" className="bg-dark-card text-white">Injured</option>
                      <option value="on-leave" className="bg-dark-card text-white">On Leave</option>
                      <option value="inactive" className="bg-dark-card text-white">Inactive</option>
                      <option value="terminated" className="bg-dark-card text-white">Terminated</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Role <span className="text-xs text-gold">(Controls permissions & app access)</span>
                    </label>
                    <select
                      value={formData.role || 'employee'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    >
                      <option value="employee" className="bg-dark-card text-white">Employee - No System Access</option>
                      <option value="foreman" className="bg-dark-card text-white">Foreman - Roxy + Reports Only</option>
                      <option value="manager" className="bg-dark-card text-white">Manager - Project Management Access</option>
                      <option value="admin" className="bg-dark-card text-white">Admin - Full System Access</option>
                      <option value="superadmin" className="bg-dark-card text-white">Super Admin - All Permissions</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-400">
                      {formData.role === 'employee'
                        ? 'Employees do not have app login access - they appear in reports only.'
                        : 'This user will have app login access with the permissions shown above.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Hourly Rate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.hourlyRate || ''}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Hire Date
                    </label>
                    <input
                      type="date"
                      value={formData.hireDate || ''}
                      onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Login Credentials - shown for non-employee roles */}
              {formData.role && formData.role !== 'employee' && (
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    App Login Credentials
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={formData.email || ''}
                        disabled
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                        placeholder="Email will be used as username"
                      />
                      <p className="mt-1 text-xs text-gray-500">Email address is used as username</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        {showAddModal ? 'Password *' : 'New Password'}
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition"
                        placeholder={showEditModal ? 'Leave blank to keep current' : 'Set login password'}
                      />
                      {showEditModal && (
                        <p className="mt-1 text-xs text-gray-500">Leave blank to keep current password</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-white/10 mt-4">
                {showEditModal && selectedMember && (
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to permanently delete ${selectedMember.fullName}? This cannot be undone.`)) {
                        handleDelete(selectedMember);
                        setShowEditModal(false);
                      }
                    }}
                    className="px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
                  >
                    Delete
                  </button>
                )}
                <div className={`flex gap-3 ${showAddModal ? 'ml-auto' : ''}`}>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                    }}
                    className="px-6 py-2 border border-white/10 text-gray-300 rounded-lg hover:bg-white/5 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showAddModal ? handleSaveNew : handleSaveEdit}
                    className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition-all duration-300 font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;

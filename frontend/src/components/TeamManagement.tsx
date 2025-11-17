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
  hasLoginAccess: boolean;
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
        const members = (data.personnel || data.data?.employees || data.employees || []).map((emp: any) => ({
          personId: emp.personId,
          employeeNumber: emp.employeeNumber || emp.employee_number,
          firstName: emp.firstName || emp.first_name,
          lastName: emp.lastName || emp.last_name,
          fullName: emp.fullName || emp.full_name || `${emp.first_name} ${emp.last_name}`,
          preferredName: emp.preferredName || emp.preferred_name,
          email: emp.email,
          phone: emp.phone,
          jobTitle: emp.jobTitle || emp.position,
          hourlyRate: emp.hourlyRate || emp.hourly_rate,
          overtimeRate: emp.overtimeRate || emp.overtime_rate,
          doubleTimeRate: emp.doubleTimeRate || emp.double_time_rate,
          employmentStatus: emp.employmentStatus || emp.employment_status,
          hireDate: emp.hireDate || emp.hire_date,
          username: emp.username,
          role: emp.role,
          hasLoginAccess: !!(emp.username && emp.passwordHash)
        }));
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
        member.jobTitle?.toLowerCase().includes(term) ||
        member.preferredName?.toLowerCase().includes(term)
      );
    }

    setFilteredTeam(filtered);
  };

  const handleAdd = () => {
    setFormData({
      employmentStatus: 'active',
      hasLoginAccess: false
    });
    setNewPassword('');
    setShowAddModal(true);
  };

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member);
    setFormData({
      ...member,
      hasLoginAccess: member.hasLoginAccess
    });
    setNewPassword('');
    setShowEditModal(true);
  };

  const handleSaveNew = async () => {
    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.preferredName?.trim()) {
      alert('First name, last name, and preferred name (nickname for Roxy) are required');
      return;
    }

    if (formData.hasLoginAccess && (!formData.email?.trim() || !formData.role || !newPassword)) {
      alert('Email, role, and password are required for login access');
      return;
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
        hireDate: formData.hireDate
      };

      // Add login credentials if enabled
      if (formData.hasLoginAccess) {
        payload.username = formData.email; // Use email as username
        payload.password = newPassword;
        payload.role = formData.role;
      }

      const response = await fetch(`${API_BASE_URL}/personnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        setShowAddModal(false);
        fetchTeam();
      } else {
        alert(result.error || 'Failed to add team member');
      }
    } catch (err) {
      alert('Failed to add team member');
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;

    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.preferredName?.trim()) {
      alert('First name, last name, and preferred name are required');
      return;
    }

    if (formData.hasLoginAccess && (!formData.email?.trim() || !formData.role)) {
      alert('Email and role are required for login access');
      return;
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
        hireDate: formData.hireDate
      };

      // Add/update login credentials if enabled
      if (formData.hasLoginAccess) {
        payload.username = formData.email;
        payload.role = formData.role;
        if (newPassword) {
          payload.password = newPassword;
        }
      } else {
        // Remove login access
        payload.username = null;
        payload.role = null;
      }

      const response = await fetch(`${API_BASE_URL}/personnel/${selectedMember.personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        setShowEditModal(false);
        fetchTeam();
      } else {
        alert(result.error || 'Failed to update team member');
      }
    } catch (err) {
      alert('Failed to update team member');
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (!confirm(`Are you sure you want to terminate ${member.fullName}?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/personnel/${member.personId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        fetchTeam();
      } else {
        alert(result.error || 'Failed to terminate team member');
      }
    } catch (err) {
      alert('Failed to terminate team member');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Team Management</h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-gray-200 space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="healthy">Healthy</option>
              <option value="injured">Injured</option>
              <option value="on-leave">On Leave</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
              <option value="terminated">Terminated</option>
            </select>
            <button
              onClick={handleAdd}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Team Member
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(90vh-220px)]">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nickname</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login Access</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTeam.map((member) => (
                  <tr key={member.personId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{member.fullName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.employeeNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.preferredName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div>{member.email || '-'}</div>
                      <div className="text-gray-500">{member.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.jobTitle || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.employmentStatus === 'active' ? 'bg-green-100 text-green-800' :
                        member.employmentStatus === 'healthy' ? 'bg-blue-100 text-blue-800' :
                        member.employmentStatus === 'injured' ? 'bg-yellow-100 text-yellow-800' :
                        member.employmentStatus === 'on-leave' ? 'bg-purple-100 text-purple-800' :
                        member.employmentStatus === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {member.employmentStatus || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${member.hourlyRate?.toFixed(2) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {member.hasLoginAccess ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {member.role || 'User'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">No Access</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Terminate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          Showing {filteredTeam.length} of {team.length} team members
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4">
              <h3 className="text-xl font-bold">
                {showAddModal ? 'Add Team Member' : 'Edit Team Member'}
              </h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Profile Information */}
              <div className="border-b pb-4">
                <h4 className="font-semibold mb-3">Profile Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee Number
                    </label>
                    <input
                      type="text"
                      value={formData.employeeNumber || ''}
                      onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., PKW01, IC101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nickname for Roxy * <span className="text-xs text-gray-500">(How Roxy identifies them)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.preferredName || ''}
                      onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="e.g., Bob, Mike, Sarah"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={formData.jobTitle || ''}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employment Status
                    </label>
                    <select
                      value={formData.employmentStatus || 'active'}
                      onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="active">Active</option>
                      <option value="healthy">Healthy</option>
                      <option value="injured">Injured</option>
                      <option value="on-leave">On Leave</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hourly Rate
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.hourlyRate || ''}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hire Date
                    </label>
                    <input
                      type="date"
                      value={formData.hireDate || ''}
                      onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Login Access */}
              <div className="border-b pb-4">
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={formData.hasLoginAccess || false}
                    onChange={(e) => setFormData({ ...formData, hasLoginAccess: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="font-semibold">Enable Login Access</label>
                </div>

                {formData.hasLoginAccess && (
                  <div className="grid grid-cols-2 gap-4 ml-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role *
                      </label>
                      <select
                        value={formData.role || ''}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select role...</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="employee">Employee</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {showAddModal ? 'Password *' : 'New Password (leave blank to keep current)'}
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder={showEditModal ? 'Leave blank to keep current' : ''}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                {showEditModal && selectedMember && (
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to permanently delete ${selectedMember.fullName}? This cannot be undone.`)) {
                        handleDelete(selectedMember);
                        setShowEditModal(false);
                      }
                    }}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={showAddModal ? handleSaveNew : handleSaveEdit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

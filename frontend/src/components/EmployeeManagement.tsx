import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface Employee {
  personId: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  employee_number?: string;
  email?: string;
  phone?: string;
  position?: string;
  project_id?: string;
  hourly_rate?: number;
  overtime_rate?: number;
  double_time_rate?: number;
  employment_status?: string;
  needs_profile_completion?: boolean;
  aliases?: string[];
  hire_date?: string;
  created_at?: string;
  last_seen_date?: string;
}

interface EmployeeManagementProps {
  onClose: () => void;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ onClose }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({});

  useEffect(() => {
    fetchEmployees();
  }, [statusFilter]);

  useEffect(() => {
    filterEmployees();
  }, [employees, searchTerm, statusFilter]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/personnel?status=${statusFilter}&limit=1000`);
      const data = await response.json();

      if (data.success) {
        setEmployees(data.data.employees || []);
      } else {
        setError(data.error || 'Failed to fetch employees');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    let filtered = [...employees];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.first_name?.toLowerCase().includes(term) ||
        emp.last_name?.toLowerCase().includes(term) ||
        emp.employee_number?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.position?.toLowerCase().includes(term)
      );
    }

    setFilteredEmployees(filtered);
  };

  const handleAddEmployee = async () => {
    // Validate required fields
    if (!formData.first_name?.trim()) {
      alert('First name is required');
      return;
    }
    if (!formData.last_name?.trim()) {
      alert('Last name is required');
      return;
    }
    if (!formData.preferred_name?.trim()) {
      alert('Preferred name (nickname) is required');
      return;
    }
    if (!formData.employee_number?.trim()) {
      alert('Employee number is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/personnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.first_name,
          lastName: formData.last_name,
          preferredName: formData.preferred_name,
          employeeNumber: formData.employee_number,
          email: formData.email,
          phone: formData.phone,
          position: formData.position,
          projectId: formData.project_id,
          hourlyRate: formData.hourly_rate,
          overtimeRate: formData.overtime_rate,
          doubleTimeRate: formData.double_time_rate
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowAddModal(false);
        setFormData({});
        fetchEmployees();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to add employee'}`);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    // Validate required fields
    if (!formData.first_name?.trim()) {
      alert('First name is required');
      return;
    }
    if (!formData.last_name?.trim()) {
      alert('Last name is required');
      return;
    }
    if (!formData.preferred_name?.trim()) {
      alert('Preferred name (nickname) is required');
      return;
    }
    if (!formData.employee_number?.trim()) {
      alert('Employee number is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/personnel/${selectedEmployee.personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.first_name,
          lastName: formData.last_name,
          preferredName: formData.preferred_name,
          employeeNumber: formData.employee_number,
          email: formData.email,
          phone: formData.phone,
          position: formData.position,
          projectId: formData.project_id,
          hourlyRate: formData.hourly_rate,
          overtimeRate: formData.overtime_rate,
          doubleTimeRate: formData.double_time_rate
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowEditModal(false);
        setSelectedEmployee(null);
        setFormData({});
        fetchEmployees();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to update employee'}`);
    }
  };

  const handleAddAlias = async (employeeId: string) => {
    const alias = prompt('Enter nickname/alias:');
    if (!alias) return;

    try {
      const response = await fetch(`${API_BASE_URL}/personnel/${employeeId}/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias })
      });

      const data = await response.json();

      if (data.success) {
        fetchEmployees();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to add alias'}`);
    }
  };

  const openEditModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setFormData({ ...employee });
    setShowEditModal(true);
  };

  const openAddModal = () => {
    setFormData({});
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-white text-xl">Loading employees...</div>
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
              <h1 className="text-2xl font-display font-bold text-white">Employee Management</h1>
              <p className="text-gray-400 text-sm mt-1">Manage employee profiles, rates, and aliases</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 glass rounded-xl p-4 border border-red-500/30">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        )}

        {/* Filters and Actions */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search by name, email, position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="active">Active</option>
              <option value="terminated">Terminated</option>
              <option value="all">All</option>
            </select>

            {/* Add Button */}
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
            >
              Add Employee
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-gray-400">
              Showing {filteredEmployees.length} of {employees.length} employees
            </p>
            <p className="text-gray-400">
              {employees.filter(e => e.needs_profile_completion).length} need profile completion
            </p>
          </div>
        </div>

        {/* Employee List */}
        <div className="space-y-4">
          {filteredEmployees.map((employee) => (
            <div key={employee.personId} className="glass rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-semibold text-white">
                      {employee.first_name} {employee.last_name}
                    </h3>
                    {employee.needs_profile_completion && (
                      <span className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400 font-medium">
                        Profile Incomplete
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      employee.employment_status === 'active'
                        ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                        : 'bg-gray-500/10 border border-gray-500/30 text-gray-400'
                    }`}>
                      {employee.employment_status || 'active'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Employee #</p>
                      <p className="text-white font-medium">{employee.employee_number || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Position</p>
                      <p className="text-white font-medium">{employee.position || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Email</p>
                      <p className="text-white font-medium">{employee.email || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Phone</p>
                      <p className="text-white font-medium">{employee.phone || 'Not set'}</p>
                    </div>
                  </div>

                  {/* Rates */}
                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Hourly Rate</p>
                      <p className="text-white font-medium">${employee.hourly_rate?.toFixed(2) || '0.00'}/hr</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Overtime Rate</p>
                      <p className="text-white font-medium">${employee.overtime_rate?.toFixed(2) || '0.00'}/hr</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Double Time Rate</p>
                      <p className="text-white font-medium">${employee.double_time_rate?.toFixed(2) || '0.00'}/hr</p>
                    </div>
                  </div>

                  {/* Aliases */}
                  {employee.aliases && employee.aliases.length > 0 && (
                    <div className="mt-4">
                      <p className="text-gray-500 text-sm mb-2">Known as:</p>
                      <div className="flex flex-wrap gap-2">
                        {employee.aliases.map((alias, idx) => (
                          <span key={idx} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-300">
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 ml-4">
                  <button
                    onClick={() => openEditModal(employee)}
                    className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleAddAlias(employee.personId)}
                    className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition text-sm font-medium"
                  >
                    Add Alias
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredEmployees.length === 0 && (
            <div className="glass rounded-xl p-12 text-center">
              <p className="text-gray-400">No employees found</p>
            </div>
          )}
        </div>
      </main>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Employee</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.first_name || ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Preferred Name/Nickname *</label>
                  <input
                    type="text"
                    value={formData.preferred_name || ''}
                    onChange={(e) => setFormData({ ...formData, preferred_name: e.target.value })}
                    placeholder="What they go by"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Employee Number *</label>
                  <input
                    type="text"
                    value={formData.employee_number || ''}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Position</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Hourly Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Overtime Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.overtime_rate || ''}
                    onChange={(e) => setFormData({ ...formData, overtime_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Double Time Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.double_time_rate || ''}
                    onChange={(e) => setFormData({ ...formData, double_time_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-4 mt-8">
              <button
                onClick={handleAddEmployee}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
              >
                Add Employee
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-3 glass text-white rounded-lg hover:bg-white/10 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">
              Edit Employee: {selectedEmployee.first_name} {selectedEmployee.last_name}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">First Name *</label>
                  <input
                    type="text"
                    value={formData.first_name || ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Last Name *</label>
                  <input
                    type="text"
                    value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Preferred Name/Nickname *</label>
                  <input
                    type="text"
                    value={formData.preferred_name || ''}
                    onChange={(e) => setFormData({ ...formData, preferred_name: e.target.value })}
                    placeholder="What they go by"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Employee Number *</label>
                  <input
                    type="text"
                    value={formData.employee_number || ''}
                    onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Position</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Hourly Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hourly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Overtime Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.overtime_rate || ''}
                    onChange={(e) => setFormData({ ...formData, overtime_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Double Time Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.double_time_rate || ''}
                    onChange={(e) => setFormData({ ...formData, double_time_rate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-4 mt-8">
              <button
                onClick={handleUpdateEmployee}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-lg hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedEmployee(null);
                }}
                className="px-6 py-3 glass text-white rounded-lg hover:bg-white/10 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;

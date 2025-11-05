import React, { useState, useMemo } from 'react';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeNumber: string;
  role: 'user' | 'manager' | 'admin';
  team: string;
  hourlyRate: number;
  status: 'active' | 'inactive' | 'on-leave';
  hoursThisWeek: number;
  totalHours: number;
}

interface AdminDashboardProps {
  onBack?: () => void;
  onNavigateToProjectSetup?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onNavigateToProjectSetup: _onNavigateToProjectSetup }) => {
  // Mock employee data
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: 'emp_001',
      name: 'John Martinez',
      email: 'john.martinez@sitelogix.com',
      phone: '(555) 123-4567',
      employeeNumber: 'EMP-001',
      role: 'manager',
      team: 'Project Alpha',
      hourlyRate: 85,
      status: 'active',
      hoursThisWeek: 42,
      totalHours: 1280
    },
    {
      id: 'emp_002',
      name: 'Sarah Johnson',
      email: 'sarah.j@sitelogix.com',
      phone: '(555) 234-5678',
      employeeNumber: 'EMP-002',
      role: 'user',
      team: 'Project Beta',
      hourlyRate: 65,
      status: 'active',
      hoursThisWeek: 38,
      totalHours: 956
    },
    {
      id: 'emp_003',
      name: 'Mike Chen',
      email: 'mike.chen@sitelogix.com',
      phone: '(555) 345-6789',
      employeeNumber: 'EMP-003',
      role: 'user',
      team: 'Project Alpha',
      hourlyRate: 70,
      status: 'active',
      hoursThisWeek: 40,
      totalHours: 1120
    },
    {
      id: 'emp_004',
      name: 'Emily Rodriguez',
      email: 'emily.r@sitelogix.com',
      phone: '(555) 456-7890',
      employeeNumber: 'EMP-004',
      role: 'admin',
      team: 'Operations',
      hourlyRate: 95,
      status: 'active',
      hoursThisWeek: 40,
      totalHours: 1600
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [_showAddModal, _setShowAddModal] = useState(false);

  // Filter and search employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === 'all' || emp.role === filterRole;
      const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employees, searchTerm, filterRole, filterStatus]);

  const handleSelectAll = () => {
    if (selectedEmployees.size === filteredEmployees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(filteredEmployees.map(e => e.id)));
    }
  };

  const handleSelectEmployee = (id: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      setEmployees(employees.filter(e => e.id !== id));
      const newSelected = new Set(selectedEmployees);
      newSelected.delete(id);
      setSelectedEmployees(newSelected);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedEmployees.size} employee(s)?`)) {
      setEmployees(employees.filter(e => !selectedEmployees.has(e.id)));
      setSelectedEmployees(new Set());
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee({ ...employee });
  };

  const handleSaveEmployee = () => {
    if (editingEmployee) {
      setEmployees(employees.map(e =>
        e.id === editingEmployee.id ? editingEmployee : e
      ));
      setEditingEmployee(null);
    }
  };

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400';
      case 'inactive': return 'bg-gray-500/20 text-gray-400';
      case 'on-leave': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getRoleBadgeColor = (role: Employee['role']) => {
    switch (role) {
      case 'admin': return 'bg-gold/20 text-gold';
      case 'manager': return 'bg-blue-500/20 text-blue-400';
      case 'user': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="glass-gold border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-display font-bold text-white">Employee Management</h1>
              <p className="text-gray-400 text-sm mt-1 font-medium">
                {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => _setShowAddModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition text-sm font-semibold flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Employee</span>
              </button>
              <button
                onClick={onBack}
                className="px-4 py-2 glass rounded-xl text-white hover:bg-white/10 transition text-sm font-medium"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Search and Filters */}
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Search Employees
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name, email, or employee number..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Role
              </label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
              >
                <option value="all" className="bg-dark-bg">All Roles</option>
                <option value="admin" className="bg-dark-bg">Admin</option>
                <option value="manager" className="bg-dark-bg">Manager</option>
                <option value="user" className="bg-dark-bg">User</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
              >
                <option value="all" className="bg-dark-bg">All Status</option>
                <option value="active" className="bg-dark-bg">Active</option>
                <option value="inactive" className="bg-dark-bg">Inactive</option>
                <option value="on-leave" className="bg-dark-bg">On Leave</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedEmployees.size > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 bg-gold/10 rounded-xl border border-gold/20">
              <p className="text-sm text-white font-medium">
                {selectedEmployees.size} employee{selectedEmployees.size !== 1 ? 's' : ''} selected
              </p>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition text-sm font-semibold"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>

        {/* Employee Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Employee</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Contact</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Role</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Team</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Rate</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Hours</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-gray-400 text-lg font-medium">No employees found</p>
                      <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-white/5 hover:bg-white/5 transition">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(employee.id)}
                          onChange={() => handleSelectEmployee(employee.id)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-white font-semibold text-sm">{employee.name}</p>
                          <p className="text-gray-500 text-xs font-mono">{employee.employeeNumber}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-gray-300 text-sm">{employee.email}</p>
                          <p className="text-gray-500 text-xs">{employee.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeColor(employee.role)}`}>
                          {employee.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-gray-300 text-sm">{employee.team}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-white font-semibold text-sm">${employee.hourlyRate}/hr</p>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-white text-sm font-semibold">{employee.hoursThisWeek}h this week</p>
                          <p className="text-gray-500 text-xs">{employee.totalHours}h total</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(employee.status)}`}>
                          {employee.status.replace('-', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditEmployee(employee)}
                            className="p-2 text-gold hover:bg-gold/10 rounded-lg transition"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setEditingEmployee(null)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold text-white">Edit Employee</h2>
              <button onClick={() => setEditingEmployee(null)} className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Employee Number</label>
                  <input
                    type="text"
                    value={editingEmployee.employeeNumber}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, employeeNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={editingEmployee.email}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={editingEmployee.phone}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Role</label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as Employee['role'] })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
                  >
                    <option value="user" className="bg-dark-bg">User</option>
                    <option value="manager" className="bg-dark-bg">Manager</option>
                    <option value="admin" className="bg-dark-bg">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Status</label>
                  <select
                    value={editingEmployee.status}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value as Employee['status'] })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition cursor-pointer"
                  >
                    <option value="active" className="bg-dark-bg">Active</option>
                    <option value="inactive" className="bg-dark-bg">Inactive</option>
                    <option value="on-leave" className="bg-dark-bg">On Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Team</label>
                  <input
                    type="text"
                    value={editingEmployee.team}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, team: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={editingEmployee.hourlyRate}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, hourlyRate: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end space-x-3">
              <button
                onClick={() => setEditingEmployee(null)}
                className="px-6 py-2 glass rounded-xl text-white hover:bg-white/10 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

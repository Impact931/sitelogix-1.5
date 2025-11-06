import React, { useState, useEffect, useMemo } from 'react';
import { fetchUsers } from '../services/userService';

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
  onNavigateToProjectProfile?: () => void;
  onNavigateToRoxy?: () => void;
  onNavigateToUserManagement?: () => void;
  onNavigateToChangePassword?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onNavigateToProjectSetup: _onNavigateToProjectSetup, onNavigateToProjectProfile, onNavigateToRoxy, onNavigateToUserManagement, onNavigateToChangePassword }) => {
  // Real employee data from API
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Fetch real employees from API
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const users = await fetchUsers();
        // Map User type to Employee type
        const mappedEmployees: Employee[] = users.map(user => ({
          id: user.userId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone || 'N/A',
          employeeNumber: user.userId.substring(0, 8).toUpperCase(),
          role: (user.role === 'superadmin' ? 'admin' : user.role) as 'user' | 'manager' | 'admin',
          team: 'N/A',
          hourlyRate: 0,
          status: user.status as 'active' | 'inactive' | 'on-leave',
          hoursThisWeek: 0,
          totalHours: 0
        }));
        setEmployees(mappedEmployees);
      } catch (error) {
        console.error('Failed to load employees:', error);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'id'>>({
    name: '',
    email: '',
    phone: '',
    employeeNumber: '',
    role: 'user',
    team: '',
    hourlyRate: 0,
    status: 'active',
    hoursThisWeek: 0,
    totalHours: 0
  });

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

  const handleAddEmployee = () => {
    const employeeToAdd: Employee = {
      ...newEmployee,
      id: `emp_${Date.now()}` // Simple ID generation
    };

    setEmployees([...employees, employeeToAdd]);
    setShowAddModal(false);

    // Reset form
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      employeeNumber: '',
      role: 'user',
      team: '',
      hourlyRate: 0,
      status: 'active',
      hoursThisWeek: 0,
      totalHours: 0
    });
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
              {onNavigateToProjectProfile && (
                <button
                  onClick={onNavigateToProjectProfile}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Manage Projects</span>
                </button>
              )}
              {onNavigateToUserManagement && (
                <button
                  onClick={onNavigateToUserManagement}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Manage Users</span>
                </button>
              )}
              {onNavigateToChangePassword && (
                <button
                  onClick={onNavigateToChangePassword}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Change Password</span>
                </button>
              )}
              {onNavigateToRoxy && (
                <button
                  onClick={onNavigateToRoxy}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple/20 transition text-sm font-semibold flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Access Roxy</span>
                </button>
              )}
              <button
                onClick={() => setShowAddModal(true)}
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

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-dark-bg/98 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-gold/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gold-light/20 to-gold-dark/20 border-b border-gold/20 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-display font-bold text-white">Add New Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Name *</label>
                  <input
                    type="text"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Employee Number *</label>
                  <input
                    type="text"
                    value={newEmployee.employeeNumber}
                    onChange={(e) => setNewEmployee({ ...newEmployee, employeeNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                    placeholder="EMP-XXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={newEmployee.phone}
                    onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Role</label>
                  <select
                    value={newEmployee.role}
                    onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as Employee['role'] })}
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
                    value={newEmployee.status}
                    onChange={(e) => setNewEmployee({ ...newEmployee, status: e.target.value as Employee['status'] })}
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
                    value={newEmployee.team}
                    onChange={(e) => setNewEmployee({ ...newEmployee, team: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                    placeholder="Project name or team"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={newEmployee.hourlyRate || ''}
                    onChange={(e) => setNewEmployee({ ...newEmployee, hourlyRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/50 transition"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/5 border-t border-white/10 p-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2 glass rounded-xl text-white hover:bg-white/10 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEmployee}
                disabled={!newEmployee.name || !newEmployee.email || !newEmployee.employeeNumber}
                className="px-6 py-2 bg-gradient-to-r from-gold-light to-gold-dark text-dark-bg rounded-xl hover:shadow-lg hover:shadow-gold/20 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

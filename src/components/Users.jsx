import React, { useState, useEffect } from 'react';

import { 

  Plus, 

  Edit, 

  Trash2, 

  User, 

  Shield, 

  UserCheck,

  X,

  Eye,

  EyeOff

} from 'lucide-react';



const Users = () => {

  const [users, setUsers] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);

  const [editingUser, setEditingUser] = useState(null);

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({

    name: '',

    email: '',

    password: '',

    role: 'cashier'

  });



  useEffect(() => {

    loadUsers();

  }, []);



  const loadUsers = () => {

    const storedUsers = JSON.parse(localStorage.getItem('pos_users') || '[]');

    setUsers(storedUsers);

  };



  const resetForm = () => {

    setFormData({

      name: '',

      email: '',

      password: '',

      role: 'cashier'

    });

    setShowPassword(false);

  };



  const handleSubmit = (e) => {

    e.preventDefault();



    const userData = {

      ...formData,

      id: editingUser ? editingUser.id : Date.now().toString()

    };



    let updatedUsers;

    if (editingUser) {

      updatedUsers = users.map(user => 

        user.id === editingUser.id ? userData : user

      );

    } else {

      // Check if email already exists

      if (users.some(user => user.email === formData.email)) {

        alert('Email already exists');

        return;

      }

      updatedUsers = [...users, userData];

    }



    setUsers(updatedUsers);

    localStorage.setItem('pos_users', JSON.stringify(updatedUsers));



    setShowAddModal(false);

    setEditingUser(null);

    resetForm();

  };



  const handleEdit = (user) => {

    setEditingUser(user);

    setFormData({

      name: user.name,

      email: user.email,

      password: user.password,

      role: user.role

    });

    setShowAddModal(true);

  };



  const handleDelete = (id) => {

    if (users.length <= 1) {

      alert('Cannot delete the last user');

      return;

    }



    if (window.confirm('Are you sure you want to delete this user?')) {

      const updatedUsers = users.filter(user => user.id !== id);

      setUsers(updatedUsers);

      localStorage.setItem('pos_users', JSON.stringify(updatedUsers));

    }

  };



  const closeModal = () => {

    setShowAddModal(false);

    setEditingUser(null);

    resetForm();

  };



  return (

    <div className="space-y-6 text-slate-100">

      {/* Header */}

      <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl shadow-lg shadow-black/10 p-6 transition-all duration-200">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

          <h1 className="text-2xl font-bold text-slate-100">User Management</h1>

          <button

            onClick={() => setShowAddModal(true)}

            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-500 transition-all duration-200 flex items-center gap-2 shadow-lg shadow-blue-950/30"

          >

            <Plus className="w-4 h-4" />

            Add User

          </button>

        </div>

      </div>



      {/* Users Grid */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {users.map((user) => (

          <div key={user.id} className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl shadow-lg shadow-black/10 p-6 transition-all duration-200">

            <div className="flex items-start justify-between mb-4">

              <div className="flex items-center gap-3">

                <div className="w-12 h-12 bg-blue-500/15 rounded-full flex items-center justify-center">

                  {user.role === 'admin' ? (

                    <Shield className="w-6 h-6 text-blue-400" />

                  ) : (

                    <User className="w-6 h-6 text-blue-400" />

                  )}

                </div>

                <div>

                  <h3 className="font-semibold text-slate-100">{user.name}</h3>

                  <p className="text-sm text-slate-400">{user.email}</p>

                </div>

              </div>

              <div className="flex gap-2">

                <button

                  onClick={() => handleEdit(user)}

                  className="p-2.5 text-blue-400 hover:bg-blue-500/10 rounded-xl transition-colors"

                >

                  <Edit className="w-4 h-4" />

                </button>

                <button

                  onClick={() => handleDelete(user.id)}

                  className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"

                >

                  <Trash2 className="w-4 h-4" />

                </button>

              </div>

            </div>



            <div className="space-y-2">

              <div className="flex items-center justify-between">

                <span className="text-sm text-slate-400">Role:</span>

                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${

                  user.role === 'admin' 

                    ? 'bg-purple-500/15 text-purple-300' 

                    : 'bg-emerald-500/15 text-emerald-300'

                }`}>

                  {user.role === 'admin' ? (

                    <>

                      <Shield className="w-3 h-3 mr-1" />

                      Admin

                    </>

                  ) : (

                    <>

                      <UserCheck className="w-3 h-3 mr-1" />

                      Cashier

                    </>

                  )}

                </span>

              </div>

            </div>



            <div className="mt-4 pt-4 border-t border-slate-800">

              <p className="text-xs text-slate-400">

                {user.role === 'admin' 

                  ? 'Full access to all features' 

                  : 'Access to POS and basic features'

                }

              </p>

            </div>

          </div>

        ))}

      </div>



      {users.length === 0 && (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg shadow-black/10 p-12 text-center">

          <User className="w-12 h-12 text-slate-500 mx-auto mb-4" />

          <h3 className="text-lg font-medium text-slate-100 mb-2">No users found</h3>

          <p className="text-slate-400">Get started by adding your first user</p>

        </div>

      )}



      {/* Add/Edit Modal */}

      {showAddModal && (

        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">

          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/30 max-w-md w-full">

            <div className="flex items-center justify-between p-6 border-b border-slate-800">

              <h2 className="text-xl font-semibold">

                {editingUser ? 'Edit User' : 'Add New User'}

              </h2>

              <button

                onClick={closeModal}

                className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400"

              >

                <X className="w-5 h-5" />

              </button>

            </div>



            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              <div>

                <label className="block text-sm font-medium text-slate-200 mb-2">

                  Full Name *

                </label>

                <input

                  type="text"

                  value={formData.name}

                  onChange={(e) => setFormData({...formData, name: e.target.value})}

                  className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"

                  required

                />

              </div>



              <div>

                <label className="block text-sm font-medium text-slate-200 mb-2">

                  Email Address *

                </label>

                <input

                  type="email"

                  value={formData.email}

                  onChange={(e) => setFormData({...formData, email: e.target.value})}

                  className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"

                  required

                />

              </div>



              <div>

                <label className="block text-sm font-medium text-slate-200 mb-2">

                  Password *

                </label>

                <div className="relative">

                  <input

                    type={showPassword ? 'text' : 'password'}

                    value={formData.password}

                    onChange={(e) => setFormData({...formData, password: e.target.value})}

                    className="w-full px-3 py-2 pr-10 bg-slate-950 text-slate-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"

                    required

                  />

                  <button

                    type="button"

                    onClick={() => setShowPassword(!showPassword)}

                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-400"

                  >

                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}

                  </button>

                </div>

              </div>



              <div>

                <label className="block text-sm font-medium text-slate-200 mb-2">

                  Role *

                </label>

                <select

                  value={formData.role}

                  onChange={(e) => setFormData({...formData, role: e.target.value})}

                  className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"

                  required

                >

                  <option value="cashier">Cashier</option>

                  <option value="admin">Admin</option>

                </select>

                <p className="text-xs text-slate-400 mt-1">

                  {formData.role === 'admin' 

                    ? 'Full access to all features including settings and user management'

                    : 'Access to POS system only'

                  }

                </p>

              </div>



              <div className="flex gap-3 pt-4">

                <button

                  type="button"

                  onClick={closeModal}

                  className="flex-1 px-4 py-2.5 border border-slate-700 text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"

                >

                  Cancel

                </button>

                <button

                  type="submit"

                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-950/30"

                >

                  {editingUser ? 'Update' : 'Add'} User

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

};



export default Users;
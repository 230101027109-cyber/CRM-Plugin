import React, { useState } from 'react';
import { User, Building, Lock, Save, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import useForm from '../utils/useForm';

const Settings = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { values, handleChange, handleSubmit } = useForm({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    currentPin: '',
    newPin: ''
  }, async (formData) => {
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);
    
    // Only send non-empty PIN fields if attempting to change PIN
    const updateData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
    };
    
    if (formData.newPin) {
      if (!formData.currentPin) {
        setErrorMsg('Current PIN is required to set a new PIN');
        setLoading(false);
        return;
      }
      updateData.currentPin = formData.currentPin;
      updateData.newPin = formData.newPin;
    }

    const res = await updateProfile(updateData);
    setLoading(false);
    
    if (res.success) {
      setSuccessMsg('Profile updated successfully');
    } else {
      setErrorMsg(res.message || 'Failed to update profile');
    }
  });

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 max-w-5xl">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <nav className="space-y-1 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'profile' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User size={18} />
              Profile Settings
            </button>
            <button
              onClick={() => setActiveTab('tenant')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'tenant' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Building size={18} />
              Organization
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'security' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Lock size={18} />
              Security
            </button>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            {successMsg && (
              <div className="m-6 mb-0 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
                {successMsg}
              </div>
            )}
            
            {errorMsg && (
              <div className="m-6 mb-0 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Profile Information</h2>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-2xl">
                      {user?.firstName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                      <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'User'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={values.firstName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={values.lastName}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input
                        type="email"
                        name="email"
                        value={values.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-gray-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        name="phone"
                        value={values.phone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tenant' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Organization Details</h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                    <input
                      type="text"
                      value={user?.tenantName || 'My Organization'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-gray-500 max-w-md"
                    />
                    <p className="text-xs text-gray-400 mt-1">Only the owner can change the organization name</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenant ID</label>
                    <input
                      type="text"
                      value={user?.tenantId || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-gray-500 font-mono text-sm max-w-md"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Change PIN</h2>
                  
                  <div className="max-w-md space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
                      <input
                        type="password"
                        name="currentPin"
                        value={values.currentPin}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 tracking-widest"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
                      <input
                        type="password"
                        name="newPin"
                        value={values.newPin}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 tracking-widest"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
                <button
                  type="submit"
                  disabled={loading || activeTab === 'tenant'}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

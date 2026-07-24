import React, { useState } from 'react';
import { Phone, Mail, Lock, User, Building, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import useForm from '../utils/useForm';

const Login = () => {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [loginMode, setLoginMode] = useState('email'); // 'email' or 'pin'
  const { login, register } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { values, handleChange, handleSubmit } = useForm({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    pin: '',
    tenantName: ''
  }, async (formData) => {
    setError('');
    setLoading(true);
    
    let res;
    if (activeTab === 'login') {
      res = await login({
        email: loginMode === 'email' ? formData.email : undefined,
        pin: formData.pin
      });
    } else {
      res = await register(formData);
    }
    
    setLoading(false);
    if (!res.success) {
      setError(res.message);
    }
  });

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-green-600/20 blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px]"></div>
      
      <div className="bg-[#1f2c34] p-8 rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-900/50">
            <Phone size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">WhatsApp CRM</h1>
          <p className="text-gray-400 mt-2 text-sm">Manage your business communication</p>
        </div>

        <div className="flex bg-[#111b21] rounded-lg p-1 mb-6">
          <button
            onClick={() => { setActiveTab('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'login' ? 'bg-[#2a3942] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'register' ? 'bg-[#2a3942] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'login' ? (
            <>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={loginMode === 'email'}
                    onChange={() => setLoginMode('email')}
                    className="accent-green-500"
                  />
                  Email + PIN
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={loginMode === 'pin'}
                    onChange={() => setLoginMode('pin')}
                    className="accent-green-500"
                  />
                  PIN Only
                </label>
              </div>

              {loginMode === 'email' && (
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="email"
                    name="email"
                    value={values.email}
                    onChange={handleChange}
                    placeholder="Email address"
                    className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 transition-colors"
                  />
                </div>
              )}
              
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="password"
                  name="pin"
                  value={values.pin}
                  onChange={handleChange}
                  placeholder="Enter PIN"
                  className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 transition-colors tracking-widest"
                  maxLength={10}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User size={18} className="absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="text"
                    name="firstName"
                    value={values.firstName}
                    onChange={handleChange}
                    placeholder="First Name"
                    className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 text-sm"
                  />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    name="lastName"
                    value={values.lastName}
                    onChange={handleChange}
                    placeholder="Last Name"
                    className="w-full px-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 text-sm"
                  />
                </div>
              </div>
              
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={values.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 text-sm"
                />
              </div>

              <div className="relative">
                <Phone size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  name="phone"
                  value={values.phone}
                  onChange={handleChange}
                  placeholder="Phone Number (e.g. 919876543210)"
                  className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 text-sm"
                />
              </div>

              <div className="relative">
                <Building size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  name="tenantName"
                  value={values.tenantName}
                  onChange={handleChange}
                  placeholder="Organization Name (Optional)"
                  className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 text-sm"
                />
              </div>

              <div className="relative">
                <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="password"
                  name="pin"
                  value={values.pin}
                  onChange={handleChange}
                  placeholder="Create PIN"
                  className="w-full pl-10 pr-4 py-3 bg-[#2a3942] border border-transparent rounded-lg focus:outline-none focus:border-green-500 text-white placeholder-gray-500 text-sm tracking-widest"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-green-900/30 flex items-center justify-center gap-2 group disabled:opacity-70"
          >
            {loading ? 'Processing...' : (activeTab === 'login' ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

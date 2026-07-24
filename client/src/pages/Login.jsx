import React from 'react';
import { useForm } from '../utils/useForm';

const Login = ({ onLogin }) => {
  const { values, handleChange, handleSubmit } = useForm({ pin: '' }, onLogin);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Phone size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">WhatsApp CRM</h1>
          <p className="text-gray-500 mt-2">Enter PIN to login</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              name="pin"
              value={values.pin}
              onChange={handleChange}
              placeholder="Enter PIN (1234)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest"
              maxLength={10}
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Login
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-6">Default PIN: 1234</p>
      </div>
    </div>
  );
};

export default Login;

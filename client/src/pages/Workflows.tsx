import React, { useState, useEffect } from 'react';
import { Workflow, Plus, Trash2, ShieldCheck, Zap, Power } from 'lucide-react';
import api from '../services/api';
import moment from 'moment';

const Workflows = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/workflows');
      if (res.data.success) {
        setWorkflows(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching workflows', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await api.put(`/workflows/${id}`, { isActive: !currentStatus });
      fetchWorkflows();
    } catch (error) {
      alert('Error updating workflow');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this custom workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      fetchWorkflows();
    } catch (error) {
      alert('Error deleting workflow');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Workflows</h1>
          <p className="text-sm text-gray-500 mt-1">Automate your CRM processes</p>
        </div>
        <button
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors opacity-50 cursor-not-allowed"
          title="Custom workflows coming soon"
        >
          <Plus size={18} />
          <span>Create Custom Workflow</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-auto pb-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin text-green-500"><Workflow size={32} /></div>
          </div>
        ) : (
          workflows.map(wf => (
            <div key={wf._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${wf.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Zap size={20} />
                    </div>
                    <h3 className="font-semibold text-gray-900">{wf.name}</h3>
                  </div>
                  {wf.isDefault && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
                      <ShieldCheck size={14} /> System Default
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-gray-600 mb-6">{wf.description}</p>
                
                <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trigger</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 capitalize">{wf.triggerEvent.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</span>
                    <p className="text-sm font-medium text-gray-900 mt-0.5 capitalize">
                      {wf.actions.map(a => a.actionType.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleStatus(wf._id, wf.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${wf.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${wf.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-sm font-medium ${wf.isActive ? 'text-green-700' : 'text-gray-500'}`}>
                    {wf.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>
                
                {!wf.isDefault && (
                  <button 
                    onClick={() => handleDelete(wf._id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Workflows;

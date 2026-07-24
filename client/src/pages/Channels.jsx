import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Plus, Trash2, Power, PowerOff, Loader, Settings2 } from 'lucide-react';
import api from '../services/api';

const Channels = () => {
  const navigate = useNavigate();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newChannel, setNewChannel] = useState({ type: 'baileys', channelName: '' });

  useEffect(() => {
    fetchChannels();
    const interval = setInterval(fetchChannels, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await api.get('/channels');
      if (res.data.success) {
        setChannels(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching channels', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/channels', newChannel);
      setShowModal(false);
      setNewChannel({ type: 'baileys', channelName: '' });
      fetchChannels();
    } catch (error) {
      alert('Error creating channel');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    try {
      await api.delete(`/channels/${id}`);
      fetchChannels();
    } catch (error) {
      alert('Error deleting');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Channels</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your connected WhatsApp numbers</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus size={18} />
          <span>Add Channel</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader className="animate-spin text-green-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map(channel => (
            <div key={channel._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${channel.type === 'baileys' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                      <Radio size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{channel.channelName}</h3>
                      <p className="text-xs text-gray-500">{channel.type === 'baileys' ? 'WhatsApp Web' : 'WhatsApp Business'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${channel.status === 'connected' ? 'bg-green-100 text-green-700' : 
                        channel.status === 'connecting' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        channel.status === 'connected' ? 'bg-green-500' : 
                        channel.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
                      }`}></span>
                      {channel.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Number</span>
                    <span className="font-medium text-gray-900">{channel.connectedNumber || 'Not connected'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Assigned To</span>
                    <span className="font-medium text-gray-900">{channel.assignedTo?.firstName || 'Anyone'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <button 
                  onClick={() => navigate(`/channels/${channel._id}`)}
                  className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  <Settings2 size={16} /> Manage Channel
                </button>
                
                <button 
                  onClick={() => handleDelete(channel._id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          
          {channels.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
              <Radio size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No channels yet</h3>
              <p className="text-gray-500 mt-1">Connect a WhatsApp number to start receiving messages</p>
            </div>
          )}
        </div>
      )}

      {/* Create Channel Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Add New Channel</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                  <input
                    type="text"
                    required
                    value={newChannel.channelName}
                    onChange={e => setNewChannel({...newChannel, channelName: e.target.value})}
                    placeholder="e.g. Main Support Number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Connection Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`
                      border rounded-xl p-3 cursor-pointer transition-all
                      ${newChannel.type === 'baileys' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-200 hover:border-green-200'}
                    `}>
                      <input 
                        type="radio" 
                        name="type" 
                        value="baileys" 
                        checked={newChannel.type === 'baileys'}
                        onChange={e => setNewChannel({...newChannel, type: e.target.value})}
                        className="sr-only"
                      />
                      <div className="font-medium text-gray-900 text-sm">WhatsApp Web</div>
                      <div className="text-xs text-gray-500 mt-1">Scan QR to connect</div>
                    </label>
                    
                    <label className={`
                      border rounded-xl p-3 cursor-not-allowed opacity-60
                      ${newChannel.type === 'whatsapp_business' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    `}>
                      <input 
                        type="radio" 
                        name="type" 
                        value="whatsapp_business"
                        disabled
                        className="sr-only"
                      />
                      <div className="font-medium text-gray-900 text-sm">Cloud API</div>
                      <div className="text-xs text-blue-600 mt-1 font-medium flex justify-between">
                        Coming soon
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Channels;

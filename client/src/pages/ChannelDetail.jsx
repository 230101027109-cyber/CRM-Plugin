import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Power, PowerOff, Smartphone, Radio, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

const ChannelDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    fetchChannel();
    const interval = setInterval(fetchChannel, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    let qrInterval;
    if (channel?.status === 'connecting') {
      fetchQR();
      qrInterval = setInterval(fetchQR, 3000);
    }
    return () => {
      if (qrInterval) clearInterval(qrInterval);
    };
  }, [channel?.status]);

  const fetchQR = async () => {
    try {
      const res = await api.get(`/channels/${id}/qr`);
      if (res.data.success && res.data.qr) {
        setQrCode(res.data.qr);
      }
    } catch (error) {
      console.error('Error fetching QR code', error);
    }
  };

  const fetchChannel = async () => {
    try {
      const res = await api.get(`/channels/${id}`);
      if (res.data.success) {
        setChannel(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching channel', error);
      navigate('/channels');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      await api.post(`/channels/${id}/connect`);
      setQrCode(null);
      fetchChannel();
    } catch (error) {
      alert('Error connecting');
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post(`/channels/${id}/disconnect`);
      setQrCode(null);
      fetchChannel();
    } catch (error) {
      alert('Error disconnecting');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader className="animate-spin text-green-500" size={32} />
      </div>
    );
  }

  if (!channel) return null;

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/channels')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Channels
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${channel.type === 'baileys' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
              <Radio size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{channel.channelName}</h1>
              <p className="text-sm text-gray-500 mt-1">{channel.type === 'baileys' ? 'WhatsApp Web' : 'WhatsApp Business'}</p>
            </div>
          </div>
          
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
            ${channel.status === 'connected' ? 'bg-green-100 text-green-700 border border-green-200' : 
              channel.status === 'connecting' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
            <span className={`w-2 h-2 rounded-full ${
              channel.status === 'connected' ? 'bg-green-500' : 
              channel.status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
            }`}></span>
            {channel.status.charAt(0).toUpperCase() + channel.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Box */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Connection Status</h2>
            
            {channel.status === 'connected' ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <Smartphone size={48} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Device Connected</h3>
                <p className="text-gray-500 mt-2 mb-6">Your WhatsApp number +{channel.connectedNumber} is successfully linked.</p>
                <button 
                  onClick={handleDisconnect}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors"
                >
                  <PowerOff size={18} /> Disconnect Device
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                {channel.status === 'connecting' ? (
                  <>
                    {qrCode ? (
                      <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm inline-block mb-6">
                          <QRCodeSVG value={qrCode} size={256} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Scan QR Code</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">Open WhatsApp on your phone, tap Menu or Settings and select Linked Devices. Point your phone to this screen to capture the code.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Loader className="animate-spin text-yellow-500 mb-4" size={48} />
                        <h3 className="text-lg font-bold text-gray-900">Generating QR Code...</h3>
                        <p className="text-gray-500 mt-2">Please wait while we initialize the connection.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
                      <Smartphone size={48} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Device Offline</h3>
                    <p className="text-gray-500 mt-2 mb-6">Connect your device to start sending and receiving messages.</p>
                    <button 
                      onClick={handleConnect}
                      className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all shadow-md shadow-green-900/10"
                    >
                      <Power size={18} /> Connect Now
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Channel Details</h2>
            <div className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Assigned To</span>
                <span className="text-gray-900">{channel.assignedTo?.firstName} {channel.assignedTo?.lastName}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone Number</span>
                <span className="text-gray-900">{channel.connectedNumber ? `+${channel.connectedNumber}` : 'Not connected'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Connection Type</span>
                <span className="text-gray-900">{channel.type === 'baileys' ? 'WhatsApp Web (Baileys)' : 'WhatsApp Business API'}</span>
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Created At</span>
                <span className="text-gray-900">{new Date(channel.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 flex gap-3">
            <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-semibold text-blue-900">Keep your phone connected</h4>
              <p className="text-xs text-blue-700 mt-1">For WhatsApp Web channels, your phone must stay connected to the internet to sync messages.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelDetail;

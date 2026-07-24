import React from 'react';
import { MessageSquare, Users, Phone, Share2, Search, Menu } from 'lucide-react';

const WhatsAppConnection = ({ status, onConnect, qrCode, syncing, onSync }) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></span>
        <span className="text-sm text-gray-600">{status === 'connected' ? 'Connected' : 'Disconnected'}</span>
      </div>
      {status !== 'connected' && (
        <button
          onClick={onConnect}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
        >
          Connect WhatsApp
        </button>
      )}
      {status === 'connected' && (
        <button
          onClick={onSync}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          {syncing ? 'Syncing...' : 'Sync Contacts'}
        </button>
      )}
      {qrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
            <p className="text-sm text-gray-600 mb-4">Open WhatsApp on your phone and scan this code</p>
            <pre className="bg-white p-4 inline-block text-xs font-mono">{qrCode}</pre>
            <p className="text-xs text-gray-400 mt-2">Or scan with your camera</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnection;

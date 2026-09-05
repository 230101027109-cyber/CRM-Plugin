import React, { useState, useEffect } from 'react';
import { Ticket, Search, Filter, Loader, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import api from '../services/api';
import moment from 'moment';

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, open, in_progress, resolved, closed

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const query = filter === 'all' ? '' : `?status=${filter}`;
      const res = await api.get(`/tickets${query}`);
      if (res.data.success) {
        setTickets(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching tickets', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'open': return <AlertCircle size={16} className="text-red-500" />;
      case 'in_progress': return <Clock size={16} className="text-blue-500" />;
      case 'resolved': return <CheckCircle2 size={16} className="text-green-500" />;
      case 'closed': return <XCircle size={16} className="text-gray-500" />;
      default: return <Ticket size={16} />;
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/tickets/${id}`, { status: newStatus });
      fetchTickets();
    } catch (error) {
      alert('Error updating status');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer support requests</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div className="flex gap-2">
            {['all', 'open', 'in_progress', 'resolved', 'closed'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors
                  ${filter === status 
                    ? 'bg-green-600 text-white' 
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500 w-64"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="animate-spin text-green-500" size={32} />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Ticket size={48} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-600">No tickets found</p>
              <p className="text-sm mt-1">Try changing your filter settings</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                  <th className="p-4 font-semibold">Subject</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Priority</th>
                  <th className="p-4 font-semibold">Assigned To</th>
                  <th className="p-4 font-semibold">Created</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tickets.map(ticket => (
                  <tr key={ticket._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{ticket.subject}</div>
                      <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">{ticket.description}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 capitalize">
                        {getStatusIcon(ticket.status)}
                        <span className="text-sm text-gray-700">{ticket.status.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs rounded-full border capitalize font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned'}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {moment(ticket.createdAt).fromNow()}
                    </td>
                    <td className="p-4 text-right">
                      <select 
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
                        className="text-sm border border-gray-300 rounded-md p-1 focus:outline-none focus:border-green-500"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Tickets;

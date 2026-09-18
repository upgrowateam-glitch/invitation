import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { io } from 'socket.io-client';
import { recipientService } from '../../services/recipientService';
import { openWhatsAppMessage } from '../../utils/whatsappUtils';
import { ChevronDown, ChevronRight, Search, Download, ExternalLink, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL?.replace('/api','') || '';

const RecipientsList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters and Sorting
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'sender', 'receiver', 'status'
  
  // Expanded Groups
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    fetchData();

    const socket = io(API_URL || 'http://localhost:5000');
    socket.on('rsvp_update', (updatedRecipient) => {
      setData(prevData => prevData.map(r => 
        r.id === updatedRecipient.id ? { ...r, ...updatedRecipient } : r
      ));
    });

    return () => socket.disconnect();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await recipientService.getRecipients();
      setData(res || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSend = async (id) => {
    await recipientService.simulateSend(id);
    await fetchData();
  };

  const handleWhatsAppShare = (r) => {
    const message = `Hi ${r.name},\n\n${r.senderName} has invited you to a special event.\n\nView your invitation and respond:\n${window.location.origin}/invitation/${r.token}`;
    openWhatsAppMessage(message);
  };

  const handleExportExcel = () => {
    if (data.length === 0) return alert("No data to export");

    // Flat format for Excel export
    const excelData = data.map(r => ({
      'Sender (Invited By)': r.senderName || 'Unknown Sender',
      'Receiver Name': r.name,
      'Template ID': r.templateId || 'N/A',
      'Status': r.responseStatus,
      'Expiry Date': r.receiveDate ? new Date(r.receiveDate).toLocaleString() : 'N/A',
      'Guests Attending': r.attendingGuests || 0,
      'Notes': r.notes || '',
      'Unique Link': `${window.location.origin}/invitation/${r.token}`
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Recipients");

    const wscols = [
      { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, 
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
      { wch: 20 }, { wch: 45 }
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, "Invitation_Tracking_Report.xlsx");
  };

  const toggleGroup = (sender) => {
    setExpandedGroups(prev => ({ ...prev, [sender]: !prev[sender] }));
  };

  // 1. Filter, Sort and Group Data
  const groupedData = useMemo(() => {
    let filtered = data.filter(r => {
      // Search
      const searchMatch = !search || 
        (r.name && r.name.toLowerCase().includes(search.toLowerCase())) ||
        (r.senderName && r.senderName.toLowerCase().includes(search.toLowerCase())) ||
        (r.email && r.email.toLowerCase().includes(search.toLowerCase())) ||
        (r.responseStatus && r.responseStatus.toLowerCase().includes(search.toLowerCase()));
      
      // Status Filter
      const statusMatch = statusFilter === 'ALL' || r.responseStatus === statusFilter;
      
      return searchMatch && statusMatch;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'sender') return (a.senderName || '').localeCompare(b.senderName || '');
      if (sortBy === 'receiver') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'status') return (a.responseStatus || '').localeCompare(b.responseStatus || '');
      return 0;
    });

    // Grouping by Normalized Sender Name
    const groups = {};
    filtered.forEach(r => {
      // Normalize: Trim spaces, reduce double spaces, title case logic approximation (keep it simple by capitalizing first letter if we want, but user said 'Display the most appropriate original formatting').
      // Let's group case-insensitively, keeping the first encountered original string as the key.
      const rawName = (r.senderName || 'Unknown Sender').trim().replace(/\s+/g, ' ');
      const key = rawName.toLowerCase();
      
      if (!groups[key]) {
        groups[key] = {
          displayName: rawName,
          recipients: [],
          total: 0,
          sent: 0,
          viewed: 0,
          accepted: 0
        };
      }
      
      const group = groups[key];
      group.recipients.push(r);
      group.total++;
      if (['SENT', 'DELIVERED', 'VIEWED', 'ACCEPTED', 'MAYBE', 'DECLINED'].includes(r.responseStatus)) group.sent++;
      if (['VIEWED', 'ACCEPTED', 'MAYBE', 'DECLINED'].includes(r.responseStatus)) group.viewed++;
      if (r.responseStatus === 'ACCEPTED') group.accepted++;
    });

    // Sort groups alphabetically by display name (or respect search)
    return Object.values(groups).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [data, search, statusFilter, sortBy]);

  // Auto-expand groups if search is active
  useEffect(() => {
    if (search.length > 0) {
      const allExpanded = {};
      groupedData.forEach(g => allExpanded[g.displayName] = true);
      setExpandedGroups(allExpanded);
    }
  }, [search, groupedData]);

  const getStatusColor = (val) => {
    if (val === 'ACCEPTED') return 'bg-green-100 text-green-800 border-green-200';
    if (val === 'DECLINED') return 'bg-red-100 text-red-800 border-red-200';
    if (val === 'MAYBE') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (val === 'VIEWED') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (val === 'SENT') return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-card-border shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recipients Tracking</h1>
          <p className="text-sm text-slate-500">Monitor engagement and RSVP status for your sent invitations.</p>
        </div>
        <button 
          onClick={handleExportExcel}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg shadow-sm hover:bg-emerald-700 hover:shadow font-medium flex items-center space-x-2 transition-all"
        >
          <Download size={18} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-card-border flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by sender or receiver name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 w-full border border-slate-200 bg-slate-50 rounded-lg p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white text-sm transition-all"
          />
        </div>
        
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto border border-slate-200 rounded-lg p-2.5 text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="NOT_SENT">Not Sent</option>
            <option value="SENT">Sent</option>
            <option value="VIEWED">Viewed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="MAYBE">Maybe</option>
            <option value="DECLINED">Declined</option>
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full md:w-auto border border-slate-200 rounded-lg p-2.5 text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="sender">Sort: Sender Name</option>
            <option value="receiver">Sort: Receiver Name</option>
            <option value="status">Sort: Status</option>
          </select>
        </div>
      </div>

      {/* Grouped Data List */}
      <div className="space-y-5 pb-12">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 bg-white border border-card-border rounded-xl shadow-sm">
            <RefreshCw size={32} className="animate-spin mb-4 text-slate-300" />
            <p className="font-medium text-slate-500">Loading your recipients...</p>
          </div>
        ) : groupedData.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center bg-white border border-card-border rounded-xl shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <Search size={28} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">No recipients found</h3>
            <p className="text-slate-500 max-w-sm">We couldn't find any recipients matching your current search and filter criteria.</p>
          </div>
        ) : (
          groupedData.map((group) => {
            const isExpanded = expandedGroups[group.displayName] !== false;
            
            return (
              <div key={group.displayName} className="bg-white border border-card-border rounded-xl shadow-sm overflow-hidden transition-all">
                {/* Group Header */}
                <button 
                  onClick={() => toggleGroup(group.displayName)}
                  className="w-full px-6 py-4 bg-white hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 group-hover:bg-slate-200 transition-colors">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800 tracking-tight">{group.displayName}</h2>
                    <span className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {group.total}
                    </span>
                  </div>
                  
                  <div className="hidden md:flex items-center space-x-5 text-sm font-medium">
                    {group.accepted > 0 && <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{group.accepted} Accepted</span>}
                    {group.viewed > 0 && <span className="text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">{group.viewed} Viewed</span>}
                    <span className="text-slate-500">{group.sent} Sent</span>
                  </div>
                </button>

                {/* Group Content */}
                {isExpanded && (
                  <div className="p-0 bg-white">
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/80 text-slate-500 uppercase text-xs font-semibold tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-6 py-4 font-semibold">Receiver Name</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.recipients.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-slate-800">{r.name}</div>
                                {r.notes && <div className="text-xs text-slate-500 mt-1 truncate max-w-xs">{r.notes}</div>}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(r.responseStatus)}`}>
                                  {r.responseStatus}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => {
                                    const url = `${window.location.origin}/invitation/${r.token}`;
                                    navigator.clipboard.writeText(url);
                                    alert('Link copied to clipboard!');
                                  }}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all font-medium text-xs shadow-sm"
                                >
                                  <span>Copy</span>
                                </button>
                                <button 
                                  onClick={() => handleWhatsAppShare(r)}
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-[#25D366]/30 bg-[#25D366]/10 text-[#128C7E] rounded-lg hover:bg-[#25D366]/20 transition-all font-bold text-xs shadow-sm"
                                >
                                  WhatsApp
                                </button>
                                <a 
                                  href={`${window.location.origin}/invitation/${r.token}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-primary/20 bg-primary/5 rounded-lg text-primary hover:bg-primary/10 transition-all font-medium text-xs shadow-sm"
                                >
                                  <ExternalLink size={14} />
                                  <span>Open</span>
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Mobile Cards */}
                    <div className="md:hidden flex flex-col divide-y divide-slate-100">
                      {group.recipients.map(r => (
                        <div key={r.id} className="p-5 space-y-4 hover:bg-slate-50 transition-colors">
                          <div className="flex justify-between items-center">
                            <div className="font-semibold text-slate-800 text-base">{r.name}</div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(r.responseStatus)}`}>
                              {r.responseStatus}
                            </span>
                          </div>
                          
                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={() => {
                                const url = `${window.location.origin}/invitation/${r.token}`;
                                navigator.clipboard.writeText(url);
                                alert('Link copied!');
                              }}
                              className="flex-1 py-2 border border-slate-200 shadow-sm rounded-lg text-sm text-slate-700 bg-white hover:bg-slate-50 font-medium transition-colors"
                            >
                              Copy
                            </button>
                            <button 
                              onClick={() => handleWhatsAppShare(r)}
                              className="flex-1 flex justify-center items-center py-2 border border-[#25D366]/30 shadow-sm rounded-lg text-sm text-[#128C7E] bg-[#25D366]/10 hover:bg-[#25D366]/20 font-bold transition-colors"
                            >
                              WhatsApp
                            </button>
                            <a 
                              href={`${window.location.origin}/invitation/${r.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 flex justify-center items-center py-2 border border-primary/20 shadow-sm rounded-lg text-sm text-primary bg-primary/5 hover:bg-primary/10 font-medium transition-colors"
                            >
                              Open
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecipientsList;

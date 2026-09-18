import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Plus, Check, Search, Upload, Filter, MoreVertical, Archive, Play, FileText, Image as ImageIcon, AlertTriangle, ShieldCheck } from 'lucide-react';
import { pdfService } from '../../services/pdfService';
import { readImageDimensions, checkResolutionQuality } from '../../utils/imageUtils';

const TemplateGallery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSelectionMode = location.pathname.includes('/select');
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, SYSTEM, UPLOADED, ARCHIVED
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection Draft State
  const [receiverName, setReceiverName] = useState('Sample Name');
  const [previewUrls, setPreviewUrls] = useState({});

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', category: 'General Invitation', file: null });
  const [fileDimensions, setFileDimensions] = useState({ width: null, height: null });
  const [resolutionInfo, setResolutionInfo] = useState({ isFullHD: false, isRecommended: true, warningMessage: null });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isSelectionMode) {
      const draft = sessionStorage.getItem('invitationDraft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.receiverName) setReceiverName(parsed.receiverName);
      }
    }
    fetchTemplates();
  }, [isSelectionMode]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/templates');
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSelectionMode || templates.length === 0) return;
    
    const generateAll = async () => {
      const urls = {};
      const activeTemps = templates.filter(t => !t.isArchived);
      for (const t of activeTemps) {
        try {
          urls[t.id] = await pdfService.generatePreview(t.id, receiverName || 'Sample Name');
        } catch (e) {
          console.error(`Error previewing template ${t.id}`);
        }
      }
      setPreviewUrls(urls);
    };
    
    const timer = setTimeout(generateAll, 500);
    return () => clearTimeout(timer);
  }, [templates, receiverName, isSelectionMode]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setNewTemplate(prev => ({ ...prev, file: null }));
      setFileDimensions({ width: null, height: null });
      setResolutionInfo({ isFullHD: false, isRecommended: true, warningMessage: null });
      return;
    }

    setNewTemplate(prev => ({ ...prev, file: selectedFile }));

    if (selectedFile.type.startsWith("image/")) {
      try {
        const dims = await readImageDimensions(selectedFile);
        setFileDimensions({ width: dims.width, height: dims.height });
        const quality = checkResolutionQuality(dims.width, dims.height);
        setResolutionInfo(quality);
      } catch (err) {
        console.warn("Could not read image dimensions:", err);
      }
    } else {
      setFileDimensions({ width: null, height: null });
      setResolutionInfo({ isFullHD: false, isRecommended: true, warningMessage: null });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!newTemplate.name || !newTemplate.file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('name', newTemplate.name);
    formData.append('description', newTemplate.description);
    formData.append('category', newTemplate.category);
    formData.append('file', newTemplate.file);

    try {
      const res = await axios.post('/api/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowUploadModal(false);
      setNewTemplate({ name: '', description: '', category: 'General Invitation', file: null });
      setFileDimensions({ width: null, height: null });
      setResolutionInfo({ isFullHD: false, isRecommended: true, warningMessage: null });
      navigate(`/invitation/admin/templates/${res.data.id}/edit`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error uploading template');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (activeTab === 'SYSTEM' && !t.isSystemTemplate) return false;
    if (activeTab === 'UPLOADED' && t.sourceType !== 'UPLOAD') return false;
    if (activeTab === 'ARCHIVED' && !t.isArchived) return false;
    if (activeTab !== 'ARCHIVED' && t.isArchived) return false;
    
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSelectTemplate = (template) => {
    if (isSelectionMode) {
      navigate(`/invitation/admin/templates/${template.id}/edit?mode=select`);
    } else {
      navigate(`/invitation/admin/templates/${template.id}/edit`);
    }
  };

  const getFileIcon = (type) => {
    if (type === 'PDF') return <FileText size={16} className="text-red-500" />;
    return <ImageIcon size={16} className="text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isSelectionMode ? 'Choose an Invitation Template' : 'Template Gallery'}
          </h1>
          <p className="text-sm text-gray-500">
            {isSelectionMode ? 'Select a design to personalize for your guest.' : 'Browse, upload, and configure your invitation designs.'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isSelectionMode && (
            <div className="flex items-center space-x-2 bg-gray-100 p-2 rounded border">
              <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Preview Name:</span>
              <input 
                type="text" 
                value={receiverName} 
                onChange={(e) => setReceiverName(e.target.value)}
                className="text-sm p-1 border rounded w-40"
              />
            </div>
          )}
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark font-medium shadow-sm transition-colors"
          >
            <Upload size={18} />
            <span>Upload Template</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
          {['ALL', 'SYSTEM', 'UPLOADED', 'ARCHIVED'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white border border-dashed rounded-xl">
            <ImageIcon size={48} className="text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-600">No templates found</p>
            <p className="text-sm">Try adjusting your filters or upload a new one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredTemplates.map(template => {
              const isFullHD = template.width && template.height ? (
                (template.height >= template.width && template.width >= 1080 && template.height >= 1920) ||
                (template.width > template.height && template.width >= 1920 && template.height >= 1080)
              ) : false;

              return (
                <div key={template.id} className="group flex flex-col bg-white rounded-xl shadow-sm border hover:shadow-md transition-all overflow-hidden relative">
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 items-center">
                    {template.isSystemTemplate && (
                      <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-purple-200">SYSTEM</span>
                    )}
                    {isFullHD && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-emerald-200 flex items-center space-x-1">
                        <ShieldCheck size={12} className="inline mr-0.5" />
                        <span>Full HD</span>
                      </span>
                    )}
                    <span className="bg-white/90 backdrop-blur-xs p-1 rounded shadow-sm">
                      {getFileIcon(template.fileType)}
                    </span>
                  </div>

                  {/* Thumbnail / Canvas */}
                  <div className="bg-gray-100 aspect-[1/1.4] relative overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => handleSelectTemplate(template)}>
                    {isSelectionMode && !template.isArchived ? (
                      previewUrls[template.id] ? (
                        <iframe 
                          src={previewUrls[template.id] + '#toolbar=0&navpanes=0&scrollbar=0&view=Fit'} 
                          className="w-full h-full border-0 pointer-events-none" 
                          title={template.name}
                        ></iframe>
                      ) : (
                        <span className="text-xs text-gray-400">Loading preview...</span>
                      )
                    ) : (
                      <img 
                        src={(() => {
                          let url = template.thumbnailPath || template.originalFilePath || "";
                          if (url.endsWith('.pdf')) url = url.replace('.pdf', '.png');
                          if (url.startsWith('http') || url.startsWith('data:')) return url;
                          if (!url.startsWith('/')) url = '/' + url;
                          const origin = import.meta.env.VITE_API_URL?.startsWith("http") 
                            ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "") 
                            : (typeof window !== "undefined" ? window.location.origin : "");
                          return `${origin}${url}`;
                        })()} 
                        alt={template.name}
                        className="w-full h-full object-contain pointer-events-none"
                        onError={(e) => {
                          if (!e.target.dataset.triedFallback) {
                            e.target.dataset.triedFallback = "true";
                            const origin = typeof window !== "undefined" ? window.location.origin : "";
                            e.target.src = `${origin}/uploads/templates/bni-template.png`;
                          }
                        }}
                      />
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="bg-white text-gray-900 rounded-full px-4 py-2 font-medium text-sm shadow-lg flex items-center space-x-1 hover:scale-105 transition-transform">
                        {isSelectionMode ? <Check size={16} /> : <Play size={16} />}
                        <span>{isSelectionMode ? 'Select' : 'Customize'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="p-3 border-t">
                    <h3 className="font-semibold text-gray-800 text-sm truncate" title={template.name}>{template.name}</h3>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-0.5">
                      <span className="truncate">{template.category || 'General'}</span>
                      {template.width && template.height && (
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                          {template.width}×{template.height}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Upload Custom Template</h2>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                <input 
                  type="text" required
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full border rounded-md p-2 focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Wedding Invite 2024"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select 
                    value={newTemplate.category}
                    onChange={e => setNewTemplate({...newTemplate, category: e.target.value})}
                    className="w-full border rounded-md p-2 focus:ring-1 focus:ring-primary"
                  >
                    <option>General Invitation</option>
                    <option>Business Meeting</option>
                    <option>Celebration</option>
                    <option>Special Guest</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File * (PNG/JPG/PDF)</label>
                  <input 
                    type="file" required 
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={handleFileChange}
                    className="w-full text-sm"
                  />
                </div>
              </div>

              {/* Detected Resolution Info & Low-Res Warning */}
              {fileDimensions.width && fileDimensions.height && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between bg-slate-50 border p-2.5 rounded-lg text-xs">
                    <span className="font-medium text-slate-700">Detected Source Resolution:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border">
                      {fileDimensions.width} × {fileDimensions.height} px
                    </span>
                  </div>

                  {resolutionInfo.warningMessage && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start space-x-2 animate-in fade-in">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-amber-900">Low Resolution Warning</p>
                        <p>{resolutionInfo.warningMessage}</p>
                      </div>
                    </div>
                  )}

                  {resolutionInfo.isFullHD && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center space-x-2">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <span className="font-medium">Full-HD Resolution Verified ({fileDimensions.width}×{fileDimensions.height})</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3 border-t">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowUploadModal(false);
                    setNewTemplate({ name: '', description: '', category: 'General Invitation', file: null });
                    setFileDimensions({ width: null, height: null });
                    setResolutionInfo({ isFullHD: false, isRecommended: true, warningMessage: null });
                  }} 
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading} 
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark font-medium text-sm disabled:opacity-50 flex items-center space-x-2"
                >
                  {isUploading ? <span>Uploading...</span> : <>
                    <Upload size={18} />
                    <span>Upload & Edit</span>
                  </>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateGallery;

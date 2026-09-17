import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Type, Image as ImageIcon, CheckCircle, AlertCircle, LayoutTemplate } from 'lucide-react';

const TemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isSelectionMode = new URLSearchParams(location.search).get('mode') === 'select';
  
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Field config state (Design Configuration)
  const [designConfig, setDesignConfig] = useState({
    pageNumber: 1,
    xPosition: 0.5,
    yPosition: 0.5,
    textBoxWidth: 0.8,
    fontFamily: 'Helvetica',
    fontSize: 48,
    textAlign: 'center',
    fontColour: '#000000',
    fontWeight: 'bold'
  });
  
  const [receiverName, setReceiverName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [warning, setWarning] = useState('');

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (id) fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      const res = await axios.get('/api/templates');
      const t = res.data.find(t => t.id === parseInt(id));
      if (!t) return navigate('/invitation/admin/templates');
      
      setTemplate(t);

      // Load session draft if in selection mode
      let draftName = '';
      if (isSelectionMode) {
        const draft = sessionStorage.getItem('invitationDraft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.receiverName) draftName = parsed.receiverName;
        }
      }

      setReceiverName(draftName || '');

      // Check if session draft already has a design config for THIS template
      let existingDesign = null;
      if (isSelectionMode) {
        const draft = sessionStorage.getItem('invitationDraft');
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.templateId === t.id && parsed.designConfiguration) {
            existingDesign = parsed.designConfiguration;
          }
        }
      }

      // Load config (prioritize existing session design, then template default)
      if (existingDesign) {
        setDesignConfig(existingDesign);
      } else if (t.defaultConfig && t.defaultConfig.length > 0) {
        const f = t.defaultConfig[0];
        setDesignConfig({
          ...designConfig,
          xPosition: f.xPosition,
          yPosition: f.yPosition,
          textBoxWidth: f.textBoxWidth || 0.8,
          fontFamily: f.fontFamily,
          fontSize: f.fontSize,
          textAlign: f.textAlignment,
          fontColour: f.fontColour,
          fontWeight: f.fontWeight
        });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefault = async () => {
    try {
      await axios.post(`/api/templates/${id}/fields`, { fields: [designConfig] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      alert('Error saving configuration');
    }
  };

  const handleUseDesign = () => {
    // Save to session storage and go to SendInvitation
    const draft = sessionStorage.getItem('invitationDraft');
    let parsed = draft ? JSON.parse(draft) : {};
    
    parsed.templateId = template.id;
    parsed.templateName = template.name;
    parsed.receiverName = receiverName;
    parsed.designConfiguration = designConfig;
    
    sessionStorage.setItem('invitationDraft', JSON.stringify(parsed));
    navigate('/invitation/admin/send');
  };

  const handlePointerDown = (e, action) => {
    e.preventDefault();
    if (action === 'drag') setIsDragging(true);
    if (action === 'resize') setIsResizing(true);
  };

  const handlePointerMove = (e) => {
    if (!isDragging && !isResizing) return;
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    if (isDragging) {
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setDesignConfig(prev => ({
        ...prev,
        xPosition: Math.max(0, Math.min(x, 1)),
        yPosition: Math.max(0, Math.min(y, 1))
      }));
    }
    
    if (isResizing) {
      const x = (e.clientX - rect.left) / rect.width;
      const newWidth = x - designConfig.xPosition;
      setDesignConfig(prev => ({
        ...prev,
        textBoxWidth: Math.max(0.1, Math.min(newWidth, 1 - prev.xPosition))
      }));
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Warning check for long text
  useEffect(() => {
    if (!containerRef.current) return;
    const boxWidth = designConfig.textBoxWidth * containerRef.current.offsetWidth;
    // Rough estimation: average character width is ~0.6 of font size
    const estimatedTextWidth = receiverName.length * (designConfig.fontSize * 0.6);
    
    if (estimatedTextWidth > boxWidth) {
      setWarning('Name is very long and may be automatically scaled down to fit the box.');
    } else {
      setWarning('');
    }
  }, [receiverName, designConfig.textBoxWidth, designConfig.fontSize]);

  if (loading || !template) return <div className="flex h-screen items-center justify-center bg-gray-50">Loading editor...</div>;

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(isSelectionMode ? '/invitation/admin/templates/select' : '/invitation/admin/templates')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <span className="font-semibold text-gray-800 border-l pl-4 truncate max-w-[200px] md:max-w-md">
            {template.name} {template.isSystemTemplate && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">SYSTEM</span>}
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          {!isSelectionMode && !template.isSystemTemplate && (
            <button 
              onClick={handleSaveDefault}
              className="px-4 py-1.5 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50 flex items-center space-x-1 transition-colors"
            >
              {isSaved ? <CheckCircle size={16} className="text-green-500"/> : <Save size={16} className="text-gray-500" />}
              <span>{isSaved ? 'Saved Default' : 'Save Default Layout'}</span>
            </button>
          )}
          
          <button 
            onClick={handleUseDesign}
            className="px-5 py-1.5 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark shadow-sm transition-colors"
          >
            Use This Design
          </button>
        </div>
      </header>

      {/* 3-Pane Canvas Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Toolbar */}
        <aside className="w-16 md:w-64 bg-white border-r flex flex-col shrink-0 z-10">
          <div className="p-2 md:p-4 space-y-1">
            <button className="w-full flex items-center p-2 md:p-3 rounded-lg bg-gray-100 text-primary font-medium hover:bg-gray-200 transition-colors">
              <Type size={20} className="md:mr-3" />
              <span className="hidden md:block">Receiver Name</span>
            </button>
            <button className="w-full flex items-center p-2 md:p-3 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors" onClick={() => navigate('/invitation/admin/templates')}>
              <LayoutTemplate size={20} className="md:mr-3" />
              <span className="hidden md:block">Templates</span>
            </button>
          </div>
          <div className="mt-auto p-4 border-t hidden md:block">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Editor Info</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Drag and resize the text box to define the area for the receiver's name. Long names will auto-scale to fit within this box.
            </p>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main 
          className="flex-1 bg-gray-100 overflow-auto flex items-center justify-center p-4 md:p-8"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="relative shadow-2xl bg-white select-none transition-transform" style={{ width: '100%', maxWidth: '600px', aspectRatio: '1/1.4' }}>
            
            <div ref={containerRef} className="absolute inset-0 z-10">
              {/* Draggable Bounding Box */}
              <div 
                className={`absolute border-2 ${isDragging || isResizing ? 'border-primary bg-primary/10' : 'border-blue-400 border-dashed hover:border-solid hover:bg-blue-500/5'} flex items-center cursor-move group`}
                style={{
                  left: `${designConfig.xPosition * 100}%`,
                  top: `${designConfig.yPosition * 100}%`,
                  width: `${designConfig.textBoxWidth * 100}%`,
                  height: `${designConfig.fontSize * 1.5}px`, // Visual height based on font size
                  marginTop: `-${(designConfig.fontSize * 1.5) / 2}px`
                }}
                onPointerDown={(e) => handlePointerDown(e, 'drag')}
              >
                {/* Text Display */}
                <div 
                  className="w-full truncate pointer-events-none px-1 flex items-center h-full"
                  style={{
                    justifyContent: designConfig.textAlign === 'center' ? 'center' : designConfig.textAlign === 'right' ? 'flex-end' : 'flex-start',
                    color: designConfig.fontColour,
                    fontWeight: designConfig.fontWeight === 'bold' ? 700 : 400,
                    fontSize: `${designConfig.fontSize}px`,
                    fontFamily: designConfig.fontFamily
                  }}
                >
                  {receiverName || 'Receiver Name'}
                </div>

                {/* Resize Handle */}
                <div 
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-white border border-gray-300 rounded shadow-sm cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handlePointerDown(e, 'resize');
                  }}
                >
                  <div className="w-0.5 h-4 bg-gray-400 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Background PDF/Image */}
            <div className="absolute inset-0 pointer-events-none">
              {template.fileType === 'PDF' ? (
                <iframe 
                  src={`${template.thumbnailPath || template.originalFilePath}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                  className="w-full h-full border-0"
                  title={template.name}
                />
              ) : (
                <img 
                  src={template.originalFilePath} 
                  alt={template.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

          </div>
        </main>

        {/* Right Properties Panel */}
        <aside className="w-64 bg-white border-l flex flex-col shrink-0 overflow-y-auto z-10 hidden lg:flex">
          <div className="p-5 space-y-6">
            
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center"><Type size={16} className="mr-2"/> Text Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Receiver Name</label>
                  <input 
                    type="text" 
                    value={receiverName} 
                    onChange={e => setReceiverName(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="Enter name"
                  />
                  {warning && <p className="text-[10px] text-yellow-600 mt-1 flex items-start"><AlertCircle size={12} className="mr-1 mt-0.5 shrink-0"/> {warning}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
                    <input 
                      type="number" min="10" max="120"
                      value={designConfig.fontSize}
                      onChange={e => setDesignConfig({...designConfig, fontSize: parseFloat(e.target.value)})}
                      className="w-full border border-gray-300 rounded p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Weight</label>
                    <select 
                      value={designConfig.fontWeight}
                      onChange={e => setDesignConfig({...designConfig, fontWeight: e.target.value})}
                      className="w-full border border-gray-300 rounded p-2 text-sm"
                    >
                      <option value="normal">Normal</option>
                      <option value="bold">Bold</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Color (Hex)</label>
                  <div className="flex space-x-2">
                    <input 
                      type="color" 
                      value={designConfig.fontColour}
                      onChange={e => setDesignConfig({...designConfig, fontColour: e.target.value})}
                      className="h-9 w-12 rounded cursor-pointer border border-gray-300 p-0.5"
                    />
                    <input 
                      type="text" 
                      value={designConfig.fontColour}
                      onChange={e => setDesignConfig({...designConfig, fontColour: e.target.value})}
                      className="flex-1 border border-gray-300 rounded p-2 text-sm uppercase font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Alignment</label>
                  <div className="flex rounded-md shadow-sm">
                    {['left', 'center', 'right'].map(align => (
                      <button
                        key={align}
                        onClick={() => setDesignConfig({...designConfig, textAlign: align})}
                        className={`flex-1 py-1.5 text-xs border ${designConfig.textAlign === align ? 'bg-primary border-primary text-white z-10' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'} ${align === 'left' ? 'rounded-l-md' : align === 'right' ? 'rounded-r-md' : '-ml-px'}`}
                      >
                        {align.charAt(0).toUpperCase() + align.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Alignment Guides</h3>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setDesignConfig({...designConfig, xPosition: 0.5 - (designConfig.textBoxWidth / 2)})}
                  className="p-2 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Center Horizontally
                </button>
                <button 
                  onClick={() => setDesignConfig({...designConfig, yPosition: 0.5})}
                  className="p-2 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Center Vertically
                </button>
              </div>
            </div>

          </div>
        </aside>

      </div>
    </div>
  );
};

export default TemplateEditor;

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import html2canvas from "html2canvas";
import { storageService } from "../../services/storageService";
import { pdfService } from "../../services/pdfService";
import { Minus, Plus, X, CheckCircle, Copy } from "lucide-react";

const WhatsAppIcon = ({ size = 24, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const MODE = import.meta.env.VITE_APP_MODE || "prototype";

const RECEIVER_NAMES = [
  "Abdul Anees CKP",
  "Abdul Kareem Acheerakath",
  "Aneesh Alakkadan",
  "Anitha Sasikumar",
  "Anshad TI",
  "Azad Kuttukkan",
  "Ebrahim Kutty P",
  "Harris P",
  "Irshad Ashraf",
  "Ismail MK",
  "Jamaludheen M",
  "Javad TP",
  "Jishnu K",
  "Jithu Nambiar",
  "Mohammed Afzal Parol",
  "Muhammad Aslam",
  "Muhammed Kunhi",
  "Muhammed Shareef P",
  "Nisha Parayil",
  "Rashid Ibrahim",
  "Reni Kotancheri",
  "Ron Saj",
  "Saji AK",
  "Shahariyar Fayaz",
  "Shahin Salam KV",
  "Shahzad Ali",
  "Shihabuddin B",
  "Sibin K",
  "Suhail Ahmed",
  "Vijesh Patteri"
];

const SendInvitation = () => {
  const navigate = useNavigate();
  const previewRef = useRef(null);
  
  const [formData, setFormData] = useState({
    senderName: "",
    receiverName: "",
    email: "",
    sendDate: "",
    receiveDate: "",
    templateId: null,
    templateName: "",
    templateUrl: "",
    designConfiguration: null
  });
  
  const [fontSize, setFontSize] = useState(42);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Auto-fetch the first template
    const fetchDefaultTemplate = async () => {
      try {
        const templates = await pdfService.getTemplates();
        if (templates && templates.length > 0) {
          const defaultTemplate = templates[0];
          setFormData(prev => ({
            ...prev,
            templateId: defaultTemplate.id,
            templateName: defaultTemplate.name,
            templateUrl: defaultTemplate.originalFilePath,
            designConfiguration: { ...(defaultTemplate.defaultConfig?.[0] || {}), yPosition: 0.42 } || {
              xPosition: 0.1,
              yPosition: 0.57,
              textAlignment: "center"
            }
          }));
        }
      } catch (err) {
        console.error("Error fetching templates:", err);
      }
    };
    fetchDefaultTemplate();
  }, []);

  const handleChange = (e) => {
    const newData = { ...formData, [e.target.name]: e.target.value };
    setFormData(newData);
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const handleSend = async (e, forceCreate = false) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const isForce = typeof e === "boolean" ? e : (forceCreate === true);

    if (!formData.senderName || !formData.receiverName || !formData.templateId) {
      alert("Please fill all required fields");
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      let base64Image = null;
      let ogBase64Image = null;
      if (previewRef.current) {
        // Capture the raw tight preview
        const rawCanvas = await html2canvas(previewRef.current, { useCORS: true, allowTaint: true });
        base64Image = rawCanvas.toDataURL("image/jpeg", 0.85); // High quality for actual viewing
        
        // Create 1200x630 Open Graph canvas
        const ogCanvas = document.createElement("canvas");
        ogCanvas.width = 1200;
        ogCanvas.height = 630;
        const ctx = ogCanvas.getContext("2d");
        
        // Fill background
        ctx.fillStyle = "#F8FAFC"; // slate-50
        ctx.fillRect(0, 0, 1200, 630);
        
        // Calculate scaling to fit within 630px height with padding
        const padding = 40;
        const targetHeight = 630 - (padding * 2);
        const scale = targetHeight / rawCanvas.height;
        const targetWidth = rawCanvas.width * scale;
        
        // Center the image
        const dx = (1200 - targetWidth) / 2;
        const dy = padding;
        
        ctx.drawImage(rawCanvas, dx, dy, targetWidth, targetHeight);
        
        // Compress to keep under 1MB
        ogBase64Image = ogCanvas.toDataURL("image/jpeg", 0.75);
      }

      const payload = {
        name: formData.receiverName.trim(),
        senderName: formData.senderName.trim(),
        sendDate: formData.sendDate || null,
        receiveDate: formData.receiveDate || null,
        templateId: formData.templateId,
        designConfiguration: formData.designConfiguration,
        forceCreate: isForce,
        base64Image,
        ogBase64Image,
        responseStatus: "SENT",
        sentDate: new Date().toISOString()
      };

      let recipient;
      if (MODE === "prototype") {
        const db = storageService.getData();
        const newId = db.recipients.length > 0 ? Math.max(...db.recipients.map(r => r.id)) + 1 : 1;
        recipient = {
          id: newId,
          ...payload,
          senderId: 1,
          invitationId: 1,
          token: Math.random().toString(36).substring(2, 15),
          responseStatus: "SENT",
          sentDate: new Date().toISOString(),
          generatedPdfPath: base64Image
        };
        db.recipients.push(recipient);
        storageService.saveData(db);
      } else {
        const res = await axios.post("/api/recipients", payload);
        recipient = res.data;
      }

      const link = `${window.location.origin}/invitation/${recipient.token}`;
      
      try {
        await navigator.clipboard.writeText(link);
        setToast({ type: "success", message: "Invitation sent! Link copied to clipboard." });
      } catch (err) {
        setToast({ type: "success", message: "Invitation sent!", link });
      }
      
      // Auto dismiss toast after 5 seconds
      setTimeout(() => setToast(null), 5000);

      setFormData(prev => ({
        ...prev,
        senderName: "",
        receiverName: "",
        receiveDate: ""
      }));

      return link;
    } catch (err) {
      if (err.response && err.response.status === 409) {
        const wantsToResend = window.confirm(err.response.data.message + "\n\nDo you want to create another one anyway?");
        if (wantsToResend) {
          return handleSend(e, true);
        }
      } else {
        alert("Error sending invitation");
        console.error(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppSend = async (e) => {
    const link = await handleSend(e);
    if (link) {
      const freshLink = `${link}?t=${Date.now()}`;
      const safeReceiver = formData.receiverName.trim();
      const safeSender = formData.senderName.trim();
      
      const message = `Hi ${safeReceiver},\n\n${safeSender} has invited you to a special event.\n\nView your invitation and respond:\n${freshLink}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
    }
  };

  const overlayStyle = {
    position: "absolute",
    left: 0,
    right: 0,
    top: "54.8%",
    transform: "translateY(-50%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#000000",
    fontFamily: "\"Clicker Script\", cursive",
    fontSize: `${fontSize}px`,
    width: "100%",
    pointerEvents: "none"
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Send Invitation</h1>
        <p className="text-sm text-slate-500">Personalize and send your customized invitations via WhatsApp.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-card-border overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-semibold text-slate-800">Invitation Details</h3>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Sender Name</label>
                <input 
                  type="text" 
                  name="senderName" 
                  placeholder="e.g. John Doe"
                  value={formData.senderName || ""} 
                  onChange={handleChange} 
                  className={`w-full bg-white text-slate-900 border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${errors.senderName ? "border-red-400" : "border-slate-200"}`} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Receiver Name</label>
                <select 
                  name="receiverName" 
                  value={formData.receiverName || ""} 
                  onChange={handleChange} 
                  className={`w-full bg-white text-slate-900 border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${errors.receiverName ? "border-red-400" : "border-slate-200"}`}
                >
                  <option value="">Select Receiver Name...</option>
                  {RECEIVER_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="px-6 py-5 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
              <button 
                onClick={handleWhatsAppSend}
                disabled={loading || !formData.senderName || !formData.receiverName || !formData.templateId}
                className="w-full justify-center px-6 py-2.5 bg-[#25D366] text-white rounded-lg font-medium shadow-sm hover:bg-[#20bd5a] hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <span className="text-sm">Processing...</span>
                ) : (
                  <>
                    <WhatsAppIcon size={20} />
                    <span>Send via WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Preview Column */}
        <div className="lg:col-span-7">
          {formData.templateUrl && (
            <div className="bg-white rounded-xl shadow-sm border border-card-border p-6 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-slate-800">Live Preview</h3>
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2 pr-3">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Font Size</span>
                    <button onClick={() => setFontSize(prev => Math.max(12, prev - 2))} className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all">
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center text-slate-700">{fontSize}</span>
                    <button onClick={() => setFontSize(prev => prev + 2)} className="p-1 hover:bg-white hover:shadow-sm rounded text-slate-600 transition-all">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="relative shadow-xl rounded-lg overflow-hidden border border-slate-200" style={{ width: '100%', maxWidth: '600px' }}>
                <div 
                  ref={previewRef}
                  style={{ 
                    position: 'relative', 
                    width: '100%', 
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    borderColor: 'transparent',
                    boxShadow: 'none',
                    textShadow: 'none',
                    outlineColor: 'transparent'
                  }}
                >
                  <img 
                    src={
                      formData.templateUrl?.startsWith("http") || formData.templateUrl?.startsWith("data:") 
                        ? formData.templateUrl 
                        : (import.meta.env.VITE_API_URL?.startsWith("http") ? import.meta.env.VITE_API_URL.replace("/api", "") : "") + formData.templateUrl
                    } 
                    alt="Template" 
                    style={{ 
                      width: "100%", 
                      display: "block",
                      color: '#000000',
                      borderColor: 'transparent',
                      boxShadow: 'none',
                      textShadow: 'none',
                      outlineColor: 'transparent'
                    }}
                    crossOrigin="anonymous"
                    onError={(e) => {
                      console.error("Image failed to load:", e.target.src);
                      e.target.style.display = 'none';
                    }}
                  />
                  <div style={{
                    ...overlayStyle,
                    color: '#000000',
                    borderColor: 'transparent',
                    boxShadow: 'none',
                    textShadow: 'none',
                    outlineColor: 'transparent'
                  }}>
                    {formData.receiverName || "Receiver Name"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl border flex items-center space-x-3 text-white transition-all transform animate-in slide-in-from-bottom-5 ${toast.type === "success" ? "bg-emerald-600 border-emerald-700" : "bg-red-600 border-red-700"}`}>
          <CheckCircle size={20} className="opacity-90" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{toast.message}</span>
            {toast.link && (
              <div className="flex items-center mt-2 space-x-2">
                <input type="text" readOnly value={toast.link} className="text-xs text-slate-800 bg-white/90 p-1.5 rounded-md w-48 shadow-inner border-0 focus:ring-0" />
                <button onClick={() => navigator.clipboard.writeText(toast.link)} className="p-1.5 bg-white/20 text-white rounded hover:bg-white/30 font-medium text-xs transition-colors">
                  Copy
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setToast(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SendInvitation;

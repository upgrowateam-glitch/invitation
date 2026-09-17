const fs = require("fs");
const file = fs.readFileSync("client/src/pages/admin/SendInvitation.jsx", "utf8");

let newFile = file.replace(`import { Minus, Plus } from "lucide-react";`, `import { Minus, Plus, X, CheckCircle, Copy } from "lucide-react";`);

newFile = newFile.replace(`const [sentSuccess, setSentSuccess] = useState(false);`, `const [toast, setToast] = useState(null);`);
newFile = newFile.replace(`const [generatedLink, setGeneratedLink] = useState("");`, ``);

// In handleSend, replace the success part
const successPart = `
      setGeneratedLink(\`\${window.location.origin}/invitation/\${recipient.token}\`);
      setSentSuccess(true);
      
      setFormData(prev => ({
        ...prev,
        senderName: "",
        receiverName: ""
      }));
`;
const newSuccessPart = `
      const link = \`\${window.location.origin}/invitation/\${recipient.token}\`;
      
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
        receiverName: ""
      }));
`;
newFile = newFile.replace(successPart, newSuccessPart);

// Remove !sentSuccess block condition in Send Invitation button
newFile = newFile.replace(`{(!sentSuccess) && (`, `{true && (`);

// Remove the inline success block
const inlineSuccessBlockRegex = /\{sentSuccess && \([\s\S]*?\}\)/;
newFile = newFile.replace(inlineSuccessBlockRegex, `
        {toast && (
          <div className={\`fixed top-6 right-6 z-50 p-4 rounded-lg shadow-xl flex items-center space-x-3 text-white transition-all transform \${toast.type === "success" ? "bg-green-600" : "bg-red-600"}\`}>
            <CheckCircle size={20} />
            <div className="flex flex-col">
              <span className="font-semibold">{toast.message}</span>
              {toast.link && (
                <div className="flex items-center mt-1 space-x-2">
                  <input type="text" readOnly value={toast.link} className="text-xs text-black p-1 rounded w-48" />
                  <button onClick={() => navigator.clipboard.writeText(toast.link)} className="p-1 bg-white text-green-700 rounded hover:bg-gray-100">
                    <Copy size={14} />
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setToast(null)} className="ml-4 hover:text-gray-200">
              <X size={18} />
            </button>
          </div>
        )}
`);

// Remove !sentSuccess condition for preview
newFile = newFile.replace(`{!sentSuccess && formData.templateUrl && (`, `{formData.templateUrl && (`);

fs.writeFileSync("client/src/pages/admin/SendInvitation.jsx", newFile);
console.log("Rewrite complete.");


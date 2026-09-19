import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { UserCheck, XCircle, HelpCircle } from "lucide-react";
import { recipientService } from "../../services/recipientService";

const InvitationPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [status, setStatus] = useState("");
  const [guests, setGuests] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const res = await recipientService.getInvitationByToken(token);
        setData(res);
        setStatus(res.recipient.responseStatus);
        setGuests(res.recipient.attendingGuests);
        setNotes(res.recipient.notes || "");
        
        if (['ACCEPTED', 'DECLINED', 'MAYBE'].includes(res.recipient.responseStatus)) {
          setSubmitted(true);
          setAlreadySubmitted(true);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Invitation not found or has expired.");
      } finally {
        setLoading(false);
      }
    };
    fetchInvitation();
  }, [token]);

  const handleRSVP = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recipientService.submitRsvp(token, { status, attendingGuests: guests, notes });
      setSubmitted(true);
    } catch (err) {
      alert("Failed to submit RSVP");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;

  const { invitation, recipient } = data;

  // Ensure correct URL for images whether locally stored or absolute
  const imageUrl = recipient.generatedPdfPath?.startsWith("http") || recipient.generatedPdfPath?.startsWith("data:") 
      ? recipient.generatedPdfPath 
      : (import.meta.env.VITE_API_URL?.startsWith("http") ? import.meta.env.VITE_API_URL.replace("/api", "") : "") + recipient.generatedPdfPath;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col items-center">
        
        {recipient.generatedPdfPath ? (
          <div className="w-full flex flex-col items-center bg-gray-50 border-b relative group">
            <img 
              src={imageUrl} 
              alt="Invitation Card" 
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
              className="block shadow-sm" 
            />
            <div className="w-full bg-slate-900/90 text-white py-2 px-4 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">Full-HD Personalized Invitation</span>
              <a 
                href={(import.meta.env.VITE_API_URL || "/api") + `/public/invitation/${token}/download`} 
                target="_blank" 
                rel="noreferrer" 
                download={`invitation-${recipient.name.replace(/\s+/g, '_')}.png`}
                className="bg-primary hover:bg-primary-dark text-white px-3 py-1 rounded font-medium transition-colors inline-flex items-center space-x-1"
              >
                <span>Download High Resolution</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="p-10 text-center">
            <h2 className="text-2xl font-serif text-gray-800">You are Invited,</h2>
            <h3 className="text-3xl font-bold text-primary mt-2">{recipient.name}</h3>
            <p className="text-gray-500 mt-2 text-lg">Hosted by {invitation.hostName}</p>
          </div>
        )}

        <div className="w-full p-6 sm:p-10 bg-white">
          {submitted ? (
            <div className="bg-green-50 text-green-800 p-4 rounded-md text-center">
              <p className="font-bold">
                {alreadySubmitted ? "Response already submitted. Thank you!" : "Thank you for your response!"}
              </p>
            </div>
          ) : (
            <form onSubmit={handleRSVP} className="space-y-6 max-w-lg mx-auto">
              <div className="grid grid-cols-3 gap-3">
                <label className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center transition-colors ${status === "ACCEPTED" ? "bg-primary border-primary text-white" : "border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-700"}`}>
                  <input type="radio" name="status" value="ACCEPTED" className="sr-only" onChange={(e) => setStatus(e.target.value)} checked={status === "ACCEPTED"} />
                  <UserCheck size={24} className="mb-2" />
                  <span className="text-sm font-medium text-center">Accept</span>
                </label>
                <label className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center transition-colors ${status === "MAYBE" ? "bg-yellow-500 border-yellow-500 text-white" : "border-gray-200 hover:bg-yellow-50 hover:border-yellow-200 text-gray-700"}`}>
                  <input type="radio" name="status" value="MAYBE" className="sr-only" onChange={(e) => setStatus(e.target.value)} checked={status === "MAYBE"} />
                  <HelpCircle size={24} className="mb-2" />
                  <span className="text-sm font-medium text-center">Maybe</span>
                </label>
                <label className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center transition-colors ${status === "DECLINED" ? "bg-gray-800 border-gray-800 text-white" : "border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-700"}`}>
                  <input type="radio" name="status" value="DECLINED" className="sr-only" onChange={(e) => setStatus(e.target.value)} checked={status === "DECLINED"} />
                  <XCircle size={24} className="mb-2" />
                  <span className="text-sm font-medium text-center">Decline</span>
                </label>
              </div>

              {status === "ACCEPTED" && invitation.allowGuests && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of additional guests (Max: {recipient.maxAllowedGuests})</label>
                  <input type="number" min="0" max={recipient.maxAllowedGuests} value={guests} onChange={(e) => setGuests(parseInt(e.target.value))} className="block w-full border border-gray-300 rounded-md py-2 px-3 shadow-sm focus:ring-primary focus:border-primary sm:text-sm" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message for the host (optional)</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="block w-full border border-gray-300 rounded-md py-2 px-3 shadow-sm focus:ring-primary focus:border-primary sm:text-sm" placeholder="Looking forward to it!" />
              </div>

              <button type="submit" disabled={!status || submitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50">
                {submitting ? "Submitting..." : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitationPage;

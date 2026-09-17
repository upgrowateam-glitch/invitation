import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your passcode');
      return;
    }
    setError('');
    setLoading(true);
    
    try {
      await login(pin.trim(), pin.trim());
      navigate('/invitation/admin/send');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3 border border-primary/20">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Brand Invites</h2>
          <p className="text-sm text-slate-500 mt-1">Enter passcode to access system</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-5 text-sm border border-red-200 text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handlePinSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 text-center">
              Enter Passcode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound size={20} />
              </div>
              <input
                type="password"
                maxLength={6}
                required
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-center text-xl tracking-[0.3em] font-mono font-bold text-slate-800 transition-all shadow-sm"
                placeholder="••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="w-full justify-center py-3 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

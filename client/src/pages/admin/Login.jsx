import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [pin, setPin] = useState('123456');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePinMode, setUsePinMode] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handlePinSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(pin || '123456', '123456');
      navigate('/invitation/admin/send');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      navigate('/invitation/admin/send');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.message || err.message || 'Login failed');
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
          <h2 className="text-2xl font-bold text-slate-900">Admin Authentication</h2>
          <p className="text-sm text-slate-500 mt-1">Enter 6-digit passcode to access system</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-5 text-sm border border-red-200 text-center font-medium">
            {error}
          </div>
        )}

        {usePinMode ? (
          <form onSubmit={handlePinSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 text-center">
                6-Digit Security Passcode
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound size={20} />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-center text-xl tracking-[0.3em] font-mono font-bold text-slate-800 transition-all shadow-sm"
                  placeholder="123456"
                />
              </div>
              <p className="text-xs text-slate-400 text-center mt-2">
                Passcode: <span className="font-bold text-primary">123456</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full justify-center py-3 px-4 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In with Passcode'}</span>
            </button>

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setUsePinMode(false)}
                className="text-xs text-slate-500 hover:text-primary transition-colors font-medium"
              >
                Or sign in with Email & Password
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="admin@demo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full justify-center py-2.5 px-4 rounded-lg font-medium text-white bg-primary hover:bg-primary-dark shadow transition-all disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setUsePinMode(true)}
                className="text-xs text-slate-500 hover:text-primary transition-colors font-medium"
              >
                Switch to 6-Digit Passcode (123456)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;

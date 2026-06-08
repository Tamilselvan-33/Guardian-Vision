import 'boxicons/css/boxicons.min.css';
import Spline from '@splinetool/react-spline';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

const Hero = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [displayText, setDisplayText] = useState('');

  const loginTitle = "SIGN IN TO GUARDIAN VISION";
  const signupTitle = "SECURE YOUR CROWD SAFETY HUB";
  const currentTitle = isSignUp ? signupTitle : loginTitle;

  useEffect(() => {
    let i = 0;
    setDisplayText('');
    const timer = setInterval(() => {
      setDisplayText(currentTitle.slice(0, i + 1));
      i++;
      if (i >= currentTitle.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [currentTitle]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        if (!form.name || !form.email || !form.password) throw new Error('Fill in all fields.');
        await apiFetch('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
        });
        setIsSignUp(false);
        setError('Account requested! Please sign in.');
      } else {
        if (!form.email || !form.password) throw new Error('Email and password required.');
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        localStorage.setItem('auth', JSON.stringify(res.user));
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <main className="relative flex flex-col lg:flex-row items-stretch min-h-[calc(100vh-5rem)] overflow-hidden bg-[#050505]">

      {/* Background Glows for Depth */}
      <div className="absolute top-1/4 -left-20 w-[30rem] h-[30rem] bg-[#e99b63]/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[40rem] h-[40rem] bg-[#e99b63]/5 blur-[150px] rounded-full pointer-events-none" />

      {/* ── LEFT PANEL: Content & Auth ── */}
      <div className="relative z-10 w-full lg:w-[65%] flex flex-col items-start justify-center pl-[8%] pr-12 py-16">

        {/* Badge */}
        <div className='inline-flex items-center gap-2 px-6 py-2 mb-10
          bg-white/5 backdrop-blur-xl rounded-full 
          border border-white/10 shadow-[0_0_30px_rgba(233,155,99,0.1)]
          text-[10px] font-bold tracking-[0.3em] text-[#e99b63] uppercase'>
          <i className='bx bx-shield-quarter text-lg animate-pulse'></i>
          Guardian Vision Safety Ops
        </div>

        {/* Heading with Typewriter Effect */}
        <h1 className='text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.05] text-white'>
          {displayText.split(' ').map((word, idx) => {
            const isHighlight = ['GUARDIAN', 'VISION', 'CROWD', 'SAFETY'].includes(word.replace(/[^A-Z]/g, ''));
            return (
              <span key={idx} className={isHighlight ? "text-[#e99b63]" : ""}>
                {word}{' '}
                {idx === 2 && <br />}
              </span>
            );
          })}
          <span className="inline-block w-1.5 h-12 bg-[#e99b63] animate-bounce ml-2 align-middle"></span>
        </h1>

        <div className="flex flex-col xl:flex-row items-start gap-12 w-full mt-2">

          {/* Main Auth Card */}
          <div className='relative w-full max-w-lg rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl p-10 shadow-[0_20px_80px_rgba(0,0,0,0.5)] border-t-[#e99b63]/20'>
            <form className='flex flex-col gap-6' onSubmit={handleSubmit}>

              {isSignUp && (
                <div className='flex flex-col gap-2'>
                  <label className='text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase ml-1'>Deployment Name</label>
                  <input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Sector-7 Commander"
                    className='bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-[#e99b63]/50 outline-none transition-all'
                  />
                </div>
              )}

              <div className='flex flex-col gap-2'>
                <label className='text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase ml-1'>Personnel ID</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@guardian.vision"
                  className='bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-[#e99b63]/50 outline-none transition-all'
                />
              </div>

              <div className='flex flex-col gap-2'>
                <label className='text-[10px] font-bold tracking-[0.2em] text-gray-500 uppercase ml-1'>Access Key</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className='bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white focus:border-[#e99b63]/50 outline-none transition-all w-full pr-12'
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} className='absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#e99b63]'>
                    <i className={`bx ${showPass ? 'bx-hide' : 'bx-show'}`} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className='mt-2 rounded-2xl py-5 px-8 font-bold tracking-[0.3em] text-[10px] text-black bg-[#e99b63] hover:bg-[#f5c89a] shadow-[0_10px_30px_rgba(233,155,99,0.2)] transition-all uppercase'
              >
                {loading ? 'Verifying...' : (isSignUp ? 'Initialize' : 'Authorize Access')}
              </button>

              <button
                type="button"
                onClick={() => setIsSignUp(p => !p)}
                className='text-center text-[10px] text-gray-500 hover:text-[#e99b63] font-bold tracking-[0.2em] uppercase transition-colors'
              >
                {isSignUp ? 'Back to Login' : 'Register New Node'}
              </button>
              {error && (
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#e99b63]">
                  {error}
                </p>
              )}
            </form>
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL: 3D BOT ── */}
      <div className="hidden lg:block absolute right-0 top-[50%] -translate-y-1/2 w-[45%] h-full pointer-events-none overflow-visible"
        style={{ transform: 'translateX(-6%) scale(1.5)' }}>
        <div className="w-full h-full min-h-[800px]">
          <Spline scene="https://prod.spline.design/vQhTGITgeIC8RZBy/scene.splinecode" />
        </div>
      </div>

    </main>
  );
};

export default Hero;

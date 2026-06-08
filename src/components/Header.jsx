import 'boxicons/css/boxicons.min.css';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

  return (
    <header className="flex justify-between items-center py-4 px-4 lg:px-20">

      {/* Brand */}
      <Link to="/" className="flex items-center gap-2 m-0 group">
        <i className='bx bx-shield-crowd text-[#e99b63] text-2xl md:text-3xl group-hover:rotate-12 transition-transform duration-300' />
        <span className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-widest">
          GUARDIAN<span className="text-[#e99b63]">VISION</span>
        </span>
      </Link>

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-10">
        {['GLOBAL NEXUS', 'INCIDENT LEDGER', 'THREAT ANALYTICS', 'AI EDGE NODE'].map(item => (
          <Link
            key={item}
            className="text-sm tracking-widest text-gray-400 transition-colors hover:text-[#e99b63] z-50"
            to={
              item === 'GLOBAL NEXUS'
                ? '/dashboard'
                : item === 'INCIDENT LEDGER'
                ? '/incidents'
                : item === 'THREAT ANALYTICS'
                ? '/analytics'
                : '/docs'
            }
          >
            {item}
          </Link>
        ))}
      </nav>

      {/* Status pill */}
      <div className="hidden md:flex items-center gap-2 border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs tracking-widest text-gray-400 font-medium">OPS ONLINE</span>
      </div>

      {/* Mobile hamburger */}
      <button onClick={toggleMobileMenu} className='md:hidden text-3xl p-2 z-50'>
        <i className="bx bx-menu" />
      </button>

      {/* Mobile Menu */}
      <div className={`${isMenuOpen ? 'flex' : 'hidden'} fixed top-16 bottom-0 right-0 left-0 p-5 md:hidden z-40 bg-black/80 backdrop-blur-md`}>
        <nav className='flex flex-col gap-6 items-center pt-8 w-full'>
          {['GLOBAL NEXUS', 'INCIDENT LEDGER', 'THREAT ANALYTICS', 'AI EDGE NODE'].map(item => (
            <Link
              key={item}
              className="text-base tracking-widest text-gray-300 hover:text-[#e99b63] transition-colors"
              to={
                item === 'GLOBAL NEXUS'
                  ? '/dashboard'
                  : item === 'INCIDENT LEDGER'
                  ? '/incidents'
                  : item === 'THREAT ANALYTICS'
                  ? '/analytics'
                  : '/docs'
              }
              onClick={() => setIsMenuOpen(false)}
            >
              {item}
            </Link>
          ))}
        </nav>
      </div>

    </header>
  );
};

export default Header;
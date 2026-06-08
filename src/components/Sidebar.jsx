import { Link, useLocation } from 'react-router-dom';
import 'boxicons/css/boxicons.min.css';

const Sidebar = () => {
    const location = useLocation();

    const navItems = [
        { name: 'Global Nexus', icon: 'bx-group', path: '/dashboard' },
        { name: 'Response Protocol', icon: 'bx-shield-exclamation', path: '/emergency', alert: true },
        { name: 'Incident Ledger', icon: 'bx-message-square-detail', path: '/incidents' },
        { name: 'Threat Analytics', icon: 'bx-bar-chart-alt-2', path: '/analytics' },
        { name: 'AI Edge Node', icon: 'bx-cctv', path: '/docs' },
    ];

    const bottomItems = [
        { name: 'Secure Log out', icon: 'bx-log-out', path: '/', action: 'logout' },
    ];

    const handleAction = (e, action) => {
        if (action === 'config') {
            e.preventDefault();
            alert("🔒 ACCESS DENIED: System Configuration controls are restricted to Level-4 Delta Administrators.");
        } else if (action === 'logout') {
            localStorage.removeItem('auth');
            // Allow default navigation to path '/' to proceed
        }
    };

    return (
        <aside className="w-64 h-screen bg-[#0a0a0a] border-r border-white/5 flex flex-col sticky top-0">
            {/* Sidebar Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-3 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#e99b63] to-[#b46a3d] flex items-center justify-center shadow-[0_0_15px_rgba(233,155,99,0.3)]">
                        <i className="bx bx-shield-crowd text-black text-xl" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white uppercase italic">Guardian<span className="text-[#e99b63]">Vision</span></span>
                    <i className="bx bx-chevron-left text-gray-500 ml-auto cursor-pointer" />
                </div>
                <p className="text-[10px] font-bold text-[#e99b63] uppercase tracking-[0.2em] ml-11">Crowd Safety v1.0</p>
            </div>

            {/* User Profile Info */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full bg-[#e99b63] shadow-[0_0_8px_#e99b63] animate-pulse" />
                    <span className="text-xs font-semibold text-gray-300">Cmdr. Abhisheik Raja</span>
                </div>
                <p className="text-sm font-bold text-gray-500 ml-4 uppercase tracking-widest">Public Safety HQ</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 flex flex-col gap-2">
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 mb-2">Navigation</p>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                                isActive 
                                ? item.alert
                                  ? 'bg-gradient-to-r from-red-500/10 to-transparent border-l-2 border-red-500 text-red-400'
                                  : 'bg-gradient-to-r from-[#e99b63]/10 to-transparent border-l-2 border-[#e99b63] text-[#e99b63]'
                                : item.alert
                                  ? 'text-red-500/60 hover:text-red-400 hover:bg-red-500/5'
                                  : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <i className={`bx ${item.icon} text-2xl group-hover:scale-110 transition-transform`} />
                            <span className="text-sm font-medium">{item.name}</span>
                            {item.alert && !isActive && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_#ef4444]" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom Menu */}
            <div className="p-4 border-t border-white/5 flex flex-col gap-2">
                {bottomItems.map((item) => (
                    <Link
                        key={item.name}
                        to={item.path || '#'}
                        onClick={(e) => item.action && handleAction(e, item.action)}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all group"
                    >
                        <i className={`bx ${item.icon} text-2xl group-hover:scale-110 transition-transform`} />
                        <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                ))}
            </div>
        </aside>
    );
};

export default Sidebar;

const { useState, useEffect, useRef } = React;

// --- Firebase Configuration ---
const firebaseConfig = { 
    apiKey: "", 
    authDomain: "", 
    projectId: "", 
    storageBucket: "", 
    messagingSenderId: "", 
    appId: "" 
};

const finalConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
const app = firebase.initializeApp(finalConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'run-realm-v1';

const MAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const DEFAULT_COORDS = [51.505, -0.09];

// --- Helper Component: Icons ---
const Icon = ({ name, size = 24, className = "", strokeWidth = 2, fill = "none" }) => {
    const iconRef = useRef(null);
    useEffect(() => {
        if (window.lucide && iconRef.current) {
            window.lucide.createIcons({
                attrs: { "stroke-width": strokeWidth, "fill": fill },
                nameAttr: "data-lucide",
                icons: { [name]: window.lucide.icons[name] }
            });
        }
    }, [name, size, className, strokeWidth, fill]);
    return <i data-lucide={name} style={{ width: size, height: size }} className={className} ref={iconRef}></i>;
};

// --- Navigation Button Component ---
const NavBtn = ({ active, onClick, icon }) => (
    <button onClick={onClick} className={`p-4 rounded-2xl transition-all duration-300 ${active ? 'bg-indigo-600/20 text-indigo-500 shadow-lg scale-110' : 'text-neutral-600'}`}>
        <Icon name={icon} size={28} strokeWidth={active ? 3 : 2} />
    </button>
);

// --- Main Application ---
function App() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [onboardingStep, setOnboardingStep] = useState(0); 
    const [activeTab, setActiveTab] = useState('map');
    const [loading, setLoading] = useState(true);

    const [userLocation, setUserLocation] = useState(DEFAULT_COORDS);
    const [territories, setTerritories] = useState([]);
    const [moments, setMoments] = useState([]);
    const [isTracking, setIsTracking] = useState(false);
    const [currentPath, setCurrentPath] = useState([]);

    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);

    // Auth Management
    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async (u) => {
            if (u) {
                setUser(u);
                const userRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users').doc(u.uid);
                userRef.onSnapshot((doc) => {
                    if (doc.exists) {
                        setUserProfile(doc.data());
                        setOnboardingStep(3);
                    } else {
                        setUserProfile({ newUser: true });
                        setOnboardingStep(1);
                    }
                    setLoading(false);
                });
            } else {
                setUser(null);
                setOnboardingStep(0);
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    // Map Initialization
    useEffect(() => {
        if (activeTab !== 'map' || onboardingStep < 3 || !mapContainerRef.current) return;
        const L = window.L;
        if (!mapInstance.current) {
            mapInstance.current = L.map(mapContainerRef.current, { zoomControl: false }).setView(userLocation, 16);
            L.tileLayer(MAP_TILE_URL).addTo(mapInstance.current);
        }
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [activeTab, onboardingStep]);

    const handleLogin = () => auth.signInAnonymously();

    const handleFinishProfile = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const profile = {
            uid: user.uid, 
            displayName: fd.get('name'), 
            handle: fd.get('handle').toLowerCase().replace(/\s/g, ''),
            bio: fd.get('bio'), 
            level: 1, 
            xp: 0, 
            timestamp: Date.now()
        };
        await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('users').doc(user.uid).set(profile);
        setOnboardingStep(2);
    };

    if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Icon name="Zap" className="text-indigo-600 animate-pulse" size={64} /></div>;

    // View: Authentication
    if (onboardingStep === 0) return (
        <div className="h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-8 space-y-12 fade-in">
            <div className="text-center space-y-4">
                <div className="size-24 bg-indigo-600 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl">
                    <Icon name="Zap" size={56} fill="white" />
                </div>
                <h1 className="text-5xl font-black italic uppercase leading-none">RunRealm</h1>
                <p className="text-neutral-500 max-w-xs mx-auto font-medium">Claim territories. Connect with runners. Conquer the world.</p>
            </div>
            <div className="w-full max-w-xs space-y-4">
                <button onClick={handleLogin} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">Login with Gmail</button>
                <button onClick={handleLogin} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">Login with Phone</button>
            </div>
        </div>
    );

    // View: App Main Shell
    return (
        <div className="flex flex-col h-screen bg-neutral-950 text-white overflow-hidden">
            <header className="p-4 bg-neutral-900/90 border-b border-white/5 flex justify-between items-center z-50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 rounded-lg"><Icon name="Zap" size={18} fill="white" /></div>
                    <h1 className="font-black italic text-xl uppercase tracking-tighter leading-none">RunRealm</h1>
                </div>
                <div className="size-9 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-full flex items-center justify-center text-sm font-black border-2 border-white/10">{userProfile?.displayName?.[0] || "?"}</div>
            </header>

            <main className="flex-1 relative overflow-y-auto">
                {activeTab === 'map' && (
                    <div className="h-full relative">
                        <div ref={mapContainerRef} className="h-full w-full opacity-90" />
                        <div className="absolute top-4 left-4 z-[1000] p-4 glass-panel rounded-[2rem] flex gap-4 shadow-2xl">
                            <div className="text-center"><p className="text-[8px] text-neutral-500 font-black uppercase mb-1">Global</p><p className="font-mono font-black text-indigo-400">{territories.length}</p></div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="text-center"><p className="text-[8px] text-neutral-500 font-black uppercase mb-1">Session</p><p className="font-mono font-black text-emerald-400">{(currentPath.length * 0.05).toFixed(0)}m</p></div>
                        </div>
                        <div className="absolute bottom-10 left-0 right-0 z-[1000] flex flex-col items-center gap-6">
                            <button onClick={() => setIsTracking(!isTracking)} className={`${isTracking ? 'bg-red-600' : 'bg-indigo-600'} p-10 rounded-[2.5rem] shadow-2xl active:scale-90 transition-all`}>
                                <Icon name={isTracking ? "Square" : "Play"} fill="white" size={32} />
                            </button>
                        </div>
                    </div>
                )}
                {/* Add Feed, Ranks, and Profile logic here similarly */}
            </main>

            <footer className="bg-neutral-900 border-t border-white/5 px-8 pt-4 pb-12 flex justify-between items-center z-50">
                <NavBtn active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon="Map" />
                <NavBtn active={activeTab === 'feed'} onClick={() => setActiveTab('feed')} icon="Users" />
                <NavBtn active={activeTab === 'ranks'} onClick={() => setActiveTab('ranks')} icon="Trophy" />
                <NavBtn active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon="User" />
            </footer>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
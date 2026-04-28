import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, Laptop, ChevronDown, ChevronUp, AlertTriangle, 
  Loader2, CreditCard, Copy, Share2, ServerCrash, 
  CheckCircle2, Circle, SlidersHorizontal, X, Tag, Filter, RefreshCw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Utility Functions ---

const parseCSV = (csvText) => {
  if (typeof csvText !== 'string') return [];
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    if (char === '"') {
      if (insideQuotes && nextChar === '"') { currentCell += '"'; i++; } 
      else { insideQuotes = !insideQuotes; }
    } else if (char === ',' && !insideQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; } 
    else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentCell.trim()); rows.push(currentRow); currentRow = []; currentCell = '';
    } else { currentCell += char; }
  }
  if (currentCell || csvText[csvText.length - 1] === ',') { currentRow.push(currentCell.trim()); }
  if (currentRow.length > 0) { rows.push(currentRow); }
  return rows;
};

const parsePrice = (priceStr) => {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  const num = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
};

const formatINR = (num) => (num === 0 || isNaN(num)) ? 'N/A' : num.toLocaleString('en-IN');

const cleanHeaderName = (headerStr) => headerStr ? headerStr.replace(/^\(\s*[A-Za-z]\s*\)\s*/, '').trim() : '';

const copyToClipboard = (text, callback) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed"; textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus(); textArea.select();
  try { if (document.execCommand('copy') && callback) callback(); } catch (err) { console.error(err); }
  document.body.removeChild(textArea);
};

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [filters, setFilters] = useState({ ram: '', ssd: '', displaySize: '', displayType: '', processor: '' });

  const showToast = (message) => { setToast(message); setTimeout(() => setToast(null), 2000); };

  // Rule 3: Auth first
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { 
          await signInWithCustomToken(auth, __initial_auth_token); 
        } else { 
          await signInAnonymously(auth); 
        }
      } catch (err) { console.error("Auth Error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // UI Protection
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) || (e.ctrlKey && e.keyCode === 85)) e.preventDefault();
    };
    const meta = document.createElement('meta');
    meta.name = "viewport"; meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.getElementsByTagName('head')[0].appendChild(meta);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('contextmenu', handleContextMenu); document.removeEventListener('keydown', handleKeyDown); };
  }, []);

  const syncData = async (isManual = false) => {
    if (!auth.currentUser) return;
    if (isManual) setRefreshing(true); else setLoading(true);
    
    // Rule 1: Strict Paths
    const cacheDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'inventoryCache', 'latest');
    
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/122AONXEgWNyc4EnWupTeLMwrLbbXsFy2/export?format=csv&gid=1160082038');
      const text = await response.text();
      const rows = parseCSV(text);
      if (rows.length > 1) {
        const headers = rows[0] || [];
        const jsonData = rows.slice(1).map(row => {
          let obj = {};
          headers.forEach((header, i) => {
            if (i >= 1 && i <= 26 && ![5, 7, 9].includes(i)) {
              const key = cleanHeaderName(header);
              if (key) obj[key] = row[i] ? row[i].trim() : '';
            }
          });
          return obj;
        });
        const validData = jsonData.filter(item => item['Marketing Name'] || item['SKU CODE']);
        
        await setDoc(cacheDocRef, { data: JSON.stringify(validData), timestamp: new Date().toISOString() });
        setData(validData);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (isManual) showToast('Inventory Refreshed');
        setError(null);
      }
    } catch (err) {
      const cacheSnap = await getDoc(cacheDocRef);
      if (cacheSnap.exists()) {
        const cached = cacheSnap.data();
        setData(JSON.parse(cached.data));
        setLastUpdated(new Date(cached.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        showToast('Using Offline Cache');
        setError(null);
      } else { setError('Connection failed.'); }
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { if (user) syncData(); }, [user]);

  const modelCategories = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const series = new Set();
    data.forEach(item => {
      const match = (item['Marketing Name'] || '').match(/book\s*(\d+)/i);
      if (match) series.add(`Book ${match[1]}`);
    });
    return Array.from(series).sort((a, b) => parseInt(b.match(/\d+/)[0]) - parseInt(a.match(/\d+/)[0]));
  }, [data]);

  const filterOptions = useMemo(() => {
    const opts = { ram: new Set(), ssd: new Set(), displaySize: new Set(), displayType: new Set(), processor: new Set() };
    data.forEach(item => {
      const getVal = (keys) => {
        const key = Object.keys(item).find(k => keys.some(sk => k.toLowerCase().includes(sk)));
        return item[key];
      };
      const r = getVal(['ram', 'memory']), s = getVal(['ssd', 'storage']), ds = getVal(['display size']), dt = getVal(['display type', 'screen type']), p = getVal(['processor', 'cpu']);
      if (r && r !== 'N/A') opts.ram.add(r); if (s && s !== 'N/A') opts.ssd.add(s); if (ds && ds !== 'N/A') opts.displaySize.add(ds); if (dt && dt !== 'N/A') opts.displayType.add(dt); if (p && p !== 'N/A') opts.processor.add(p);
    });
    return { ram: [...opts.ram].sort(), ssd: [...opts.ssd].sort(), displaySize: [...opts.displaySize].sort(), displayType: [...opts.displayType].sort(), processor: [...opts.processor].sort() };
  }, [data]);

  const processedData = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    const queryNoSpaces = query.replace(/\s+/g, '');

    return data.filter(item => {
      const name = (item['Marketing Name'] || '').toLowerCase();
      const sku = (item['SKU CODE'] || '').toLowerCase();
      const model = (item['Model'] || '').toLowerCase();

      // STRICT EXACT SEARCH
      if (query) {
        const isExactMatch = name.includes(query) || sku.includes(query) || model.includes(query);
        const nameNoSpace = name.replace(/\s+/g, '');
        const isNormalizedMatch = nameNoSpace.includes(queryNoSpaces);
        if (!isExactMatch && !isNormalizedMatch) return false;
      }

      // STRICT CATEGORY TAB
      if (activeCategory !== 'All') {
        const catNum = activeCategory.match(/\d+/)[0];
        const nameNormalized = name.replace(/\s+/g, '');
        if (!nameNormalized.includes(`book${catNum}`)) return false;
      }

      // FILTERS
      const checkFilter = (val, keys) => {
        if (!val) return true;
        const key = Object.keys(item).find(k => keys.some(sk => k.toLowerCase().includes(sk)));
        return item[key] === val;
      };

      return checkFilter(filters.ram, ['ram', 'memory']) &&
             checkFilter(filters.ssd, ['ssd', 'storage']) &&
             checkFilter(filters.displaySize, ['display size']) &&
             checkFilter(filters.displayType, ['display type', 'screen type']) &&
             checkFilter(filters.processor, ['processor', 'cpu']);
    });
  }, [data, searchTerm, filters, activeCategory]);

  const activeFilterCount = Object.values(filters).filter(val => val !== '').length;
  const resetFilters = () => setFilters({ ram: '', ssd: '', displaySize: '', displayType: '', processor: '' });

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5]">
        <div className="h-24 w-24 rounded-[32px] bg-white shadow-xl border border-white flex flex-col items-center justify-center mb-6 relative">
          <Laptop className="h-8 w-8 text-indigo-600 animate-pulse" />
          <Loader2 className="absolute -bottom-2 -right-2 h-6 w-6 text-indigo-600 animate-spin bg-white rounded-full p-1" />
        </div>
        <p className="font-bold text-slate-700 tracking-widest text-xs uppercase">Syncing Cloud Vault</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 font-sans pb-10 select-none relative">
      {/* Fixed Decor Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-400/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-400/10 rounded-full blur-[100px]"></div>
      </div>
      
      {/* 🚀 FIXED STICKY HEADER 🚀 */}
      <header className="sticky top-0 z-[100] bg-white/60 backdrop-blur-[50px] border-b border-white/50 px-4 pt-4 pb-2 shadow-sm">
        <div className="max-w-2xl mx-auto">
          {/* Top Line */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-xl shadow-md"><Laptop size={14} className="text-white" /></div>
              <h1 className="font-black text-xs tracking-widest text-slate-700 uppercase">Galaxy Book</h1>
            </div>
            <div className="flex items-center gap-2">
              {lastUpdated && !showFilters && <span className="text-[9px] font-black text-slate-400 bg-slate-100/50 px-2.5 py-1 rounded-full border border-slate-200/50 uppercase">{lastUpdated}</span>}
              <button onClick={() => syncData(true)} disabled={refreshing} className={`p-2 bg-indigo-600 text-white rounded-full shadow-lg transition-all active:scale-90 ${refreshing ? 'animate-spin opacity-50' : ''}`}><RefreshCw size={14} strokeWidth={3} /></button>
            </div>
          </div>

          {/* Search Bar Row */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-grow group">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Type exact model (e.g. Book 5)" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-white/80 outline-none focus:border-indigo-300 focus:bg-white bg-white/40 backdrop-blur-md text-sm font-semibold shadow-sm transition-all" 
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center justify-center w-11 h-[2.6rem] rounded-2xl active:scale-90 relative transition-all ${showFilters ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-white/80 shadow-sm'}`}>
              <SlidersHorizontal size={16} />
              {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-white shadow-md">{activeFilterCount}</span>}
            </button>
          </div>

          {/* Series Tabs */}
          <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar scroll-smooth">
            <button onClick={() => setActiveCategory('All')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black border transition-all ${activeCategory === 'All' ? 'bg-slate-800 text-white border-slate-700 shadow-md' : 'bg-white/40 text-slate-600 border-white/60'}`}>All</button>
            {modelCategories.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black border transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-400 shadow-md' : 'bg-white/40 text-slate-600 border-white/60'}`}>{cat}</button>)}
          </div>

          {/* Filter Panel (Inline within Header) */}
          {showFilters && (
            <div className="mt-2 p-4 bg-white/90 border border-white rounded-[24px] shadow-2xl animate-in slide-in-from-top-2 duration-300 mb-3">
              <div className="flex items-center justify-between mb-4 px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-2"><span>Hardware Refinement</span></div>
                {activeFilterCount > 0 && <button onClick={resetFilters} className="text-red-500 bg-red-50 px-2 py-1 rounded-lg">Reset</button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><FilterSelect label="Processor" value={filters.processor} options={filterOptions.processor} onChange={(v) => setFilters({...filters, processor: v})} /></div>
                <FilterSelect label="RAM" value={filters.ram} options={filterOptions.ram} onChange={(v) => setFilters({...filters, ram: v})} />
                <FilterSelect label="SSD" value={filters.ssd} options={filterOptions.ssd} onChange={(v) => setFilters({...filters, ssd: v})} />
              </div>
              <button onClick={() => setShowFilters(false)} className="w-full mt-4 bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Show {processedData.length} Results</button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex justify-between items-center px-1">
           <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Inventory: <span className="text-indigo-600">{processedData.length}</span> Devices</p>
           {(searchTerm || activeFilterCount > 0) && <button onClick={() => {setSearchTerm(''); resetFilters(); setActiveCategory('All');}} className="text-[10px] font-black text-indigo-600 underline underline-offset-4">Reset View</button>}
        </div>

        {processedData.length > 0 ? (
          <div className="space-y-6">
            {processedData.map((laptop, index) => <LiquidGlassCard key={`${laptop['SKU CODE']}-${index}`} item={laptop} onToast={showToast} />)}
          </div>
        ) : (
          <div className="text-center py-24 bg-white/40 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-xl animate-in fade-in duration-500">
            <div className="h-16 w-16 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-4 border border-white"><AlertTriangle className="h-8 w-8 text-slate-300" /></div>
            <p className="font-bold text-slate-700 text-lg">No Exact Match Found</p>
            <p className="text-xs text-slate-400 mt-1">Strict matching active.</p>
          </div>
        )}
      </main>

      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900/90 backdrop-blur-xl text-white text-xs font-bold rounded-full shadow-2xl animate-in slide-in-from-bottom-4 duration-300">{toast}</div>}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}

const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="relative group">
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full px-4 py-2.5 text-[11px] font-black rounded-xl border transition-all appearance-none outline-none ${value ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-100 text-slate-600'}`}><option value="">{label} (All)</option>{options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}</select>
    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform duration-300" />
  </div>
);

function LiquidGlassCard({ item, onToast }) {
  const [expanded, setExpanded] = useState(false);
  const [useBankOffer, setUseBankOffer] = useState(false);
  const [useUpgrade, setUseUpgrade] = useState(false);

  const colors = (item['Color'] || '').split(',').map(c => c.trim()).filter(Boolean);
  const name = item['Marketing Name'] || item['Model'] || 'Unknown Device';
  const sku = item['SKU CODE'] || item['SKU'] || 'N/A';
  
  const mop = parsePrice(item['MOP']), support = parsePrice(item['Support'] || item['Sellout Support']), bankCb = parsePrice(item['Bank CB- HDFC'] || item['Bank CB']), upgrade = parsePrice(item['Upgrade'] || item['Exchange']);
  let offerPrice = Math.max(0, mop - support);
  if (useBankOffer) offerPrice -= bankCb;
  if (useUpgrade) offerPrice -= upgrade;

  const getShareText = () => {
    let text = `*Galaxy Book Quotation*\n--------------------------\n*Model:* ${name}\n*SKU:* ${sku}\n\n`;
    text += `MOP: ₹${formatINR(mop)}\nStore Support: -₹${formatINR(support)}\nBank Offer: -₹${formatINR(bankCb)}\nUpgrade Bonus: -₹${formatINR(upgrade)}\n\n*FINAL PRICE: ₹${formatINR(offerPrice)}*\n--------------------------\n`;
    Object.entries(item).forEach(([k, v]) => { if(v && v !== 'N/A' && !['Marketing Name', 'MOP', 'Support', 'Bank CB- HDFC', 'Upgrade', 'SKU CODE', 'Color'].some(key => k.toLowerCase().includes(key.toLowerCase()))) text += `• ${k}: ${v}\n`; });
    return text;
  };

  return (
    <div className="bg-white/40 backdrop-blur-[40px] rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] border border-white/50 transition-all duration-500 overflow-hidden relative">
      <div className="p-5 pb-2 flex gap-4 items-start relative z-10">
        <div className="h-16 w-16 bg-white/60 backdrop-blur-md rounded-[24px] shadow-sm border border-white flex items-center justify-center flex-shrink-0"><Laptop className="h-7 w-7 text-indigo-600" /></div>
        <div className="flex-grow min-w-0 pt-1">
          <p onClick={() => copyToClipboard(sku, () => onToast('SKU Copied'))} className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5 select-text cursor-pointer hover:underline">{sku}</p>
          <h2 className="text-[17px] font-black text-slate-800 leading-tight pr-1 line-clamp-2">{name}</h2>
          <p className="text-[11px] font-bold text-slate-400 mt-2 truncate">{item['Processor']} | {item['RAM']} | {item['SSD']}</p>
        </div>
      </div>

      <div className="px-5 pb-4 relative z-10">
        <div className="bg-white/30 backdrop-blur-md rounded-[28px] p-4 border border-white/40 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex justify-between items-center mb-3 px-1 text-[10px] font-black uppercase tracking-widest">
            <div><span className="text-slate-400">MOP</span><span className={`block text-[15px] font-black mt-0.5 ${support > 0 ? 'line-through text-slate-400' : 'text-slate-800'}`}>₹{formatINR(mop)}</span></div>
            {support > 0 && <div className="text-right text-emerald-500"><span>Support</span><span className="block text-[15px] font-black mt-0.5">-₹{formatINR(support)}</span></div>}
          </div>
          <div className="flex flex-col gap-2">
            {bankCb > 0 && <button onClick={() => setUseBankOffer(!useBankOffer)} className={`w-full flex items-center justify-between px-4 py-3 rounded-[18px] text-[12px] font-black transition-all ${useBankOffer ? 'bg-blue-600 text-white shadow-lg border border-blue-400' : 'bg-white/60 text-slate-700 border border-white'}`}><div className="flex items-center gap-2.5"><CreditCard size={14} className={useBankOffer ? 'text-blue-100' : 'text-slate-400'} /><span>Bank Offer</span></div><div className="flex items-center gap-2"><span>-₹{formatINR(bankCb)}</span>{useBankOffer ? <CheckCircle2 size={16} fill="white" className="text-blue-600"/> : <Circle size={16} className="text-slate-300"/>}</div></button>}
            {upgrade > 0 && <button onClick={() => setUseUpgrade(!useUpgrade)} className={`w-full flex items-center justify-between px-4 py-3 rounded-[18px] text-[12px] font-black transition-all ${useUpgrade ? 'bg-orange-500 text-white shadow-lg border border-orange-400' : 'bg-white/60 text-slate-700 border border-white'}`}><div className="flex items-center gap-2.5"><Tag size={14} className={useUpgrade ? 'text-orange-100' : 'text-slate-400'} /><span>Upgrade</span></div><div className="flex items-center gap-2"><span>-₹{formatINR(upgrade)}</span>{useUpgrade ? <CheckCircle2 size={16} fill="white" className="text-orange-500"/> : <Circle size={16} className="text-slate-300"/>}</div></button>}
          </div>
          <div className="mt-4 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[22px] px-5 py-4 flex items-center justify-between text-white shadow-lg border border-indigo-400/30">
            <div><span className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.2em] block mb-0.5">Offer Price</span><span className="text-2xl font-black tracking-tight">₹{formatINR(offerPrice)}</span></div>
            <Laptop size={20} className="opacity-30" />
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 flex justify-between items-center relative z-10">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[50%]">{colors.length > 0 ? colors.map((c, i) => <span key={i} className="px-2.5 py-1 bg-white/50 border border-white rounded-[10px] text-[9px] font-black text-slate-500 uppercase tracking-tighter">{c}</span>) : <span className="text-[9px] text-slate-400 font-bold ml-1 uppercase">Standard</span>}</div>
        <div className="flex gap-2">
          <button onClick={() => copyToClipboard(getShareText(), () => onToast('Quotation Copied'))} className="h-10 w-10 bg-white/60 border border-white rounded-[16px] flex items-center justify-center text-slate-600 active:scale-90"><Copy size={16} /></button>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 px-4 h-10 rounded-[16px] text-[11px] font-black text-slate-700 bg-white/60 border border-white active:scale-90">{expanded ? 'Hide' : 'Specs'}<ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>
      {expanded && (
        <div className="px-6 pb-6 pt-2 bg-white/20 border-t border-white/40 backdrop-blur-md">
          <div className="grid grid-cols-1 gap-2 mt-2">
            {Object.entries(item).map(([k, v], i) => {
              if (!v || v === 'N/A' || ['Marketing Name', 'Model', 'Name', 'MOP', 'Support', 'Bank CB', 'Upgrade', 'Color', 'SKU CODE'].some(key => k.toLowerCase().includes(key.toLowerCase()))) return null;
              return <div key={i} className="flex justify-between border-b border-slate-300/20 pb-1.5 pt-1 last:border-0"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{k}</span><span className="text-[11px] font-black text-slate-800 text-right w-2/3 truncate">{v}</span></div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

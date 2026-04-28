import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Laptop, ChevronDown, AlertTriangle, 
  Loader2, CreditCard, Copy, Share2, ServerCrash, 
  CheckCircle2, Circle, SlidersHorizontal, X, Tag, Filter, RefreshCw
} from 'lucide-react';

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
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [filters, setFilters] = useState({ ram: '', ssd: '', displaySize: '', displayType: '', processor: '' });

  const showToast = (message) => { setToast(message); setTimeout(() => setToast(null), 2000); };

  // Browser Security & UI Setup
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

  // Fetch Logic (Optimized, No Firebase)
  const syncData = async (isManual = false) => {
    if (isManual) setRefreshing(true); else setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/122AONXEgWNyc4EnWupTeLMwrLbbXsFy2/export?format=csv&gid=1160082038');
      if (!response.ok) throw new Error('Failed to load data. Please check your internet connection.');
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
        
        setData(validData);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (isManual) showToast('Inventory Refreshed');
      }
    } catch (err) {
      setError(err.message || 'Network Error. Failed to fetch data.');
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  };

  // Fetch initially on mount
  useEffect(() => { 
    syncData(); 
  }, []);

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
      <div className="relative min-h-screen w-full bg-[#050505] text-white/90 overflow-hidden font-sans flex flex-col items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute inset-0" style={{ backgroundColor: '#0a0a0a', backgroundImage: 'radial-gradient(circle at 60% 40%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '100% 100%, 6px 6px', backgroundPosition: '0 0, 0 0' }}></div>
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[100px] mix-blend-screen"></div>
          <div className="absolute bottom-1/4 right-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] h-24 w-24 flex flex-col items-center justify-center mb-6 relative">
            <Laptop className="h-8 w-8 text-white animate-pulse" />
            <Loader2 className="absolute -bottom-2 -right-2 h-6 w-6 text-white animate-spin bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20" />
          </div>
          <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">Fetching Inventory</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-white/90 overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0" style={{ backgroundColor: '#0a0a0a', backgroundImage: 'radial-gradient(circle at 60% 40%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '100% 100%, 6px 6px', backgroundPosition: '0 0, 0 0' }}></div>
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[100px] mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen"></div>
      </div>
      
      <div className="relative z-10 h-screen w-full overflow-y-auto overflow-x-hidden pb-10">
        <div className="max-w-2xl mx-auto flex flex-col p-4 space-y-6">
          
          <header className="sticky top-0 z-[100] bg-black/40 backdrop-blur-[50px] border border-white/10 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 border border-white/20 p-2 rounded-[16px] shadow-inner"><Laptop size={16} className="text-white" /></div>
                <h1 className="text-[24px] sm:text-[28px] font-bold text-white drop-shadow-md tracking-tight leading-none">Galaxy Book</h1>
              </div>
              <div className="flex items-center gap-2">
                {lastUpdated && !showFilters && <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest hidden sm:inline">{lastUpdated}</span>}
                <button onClick={() => syncData(true)} disabled={refreshing} className={`px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full hover:bg-white/20 transition-colors font-bold text-[12px] shadow-sm flex items-center justify-center gap-2 active:scale-95 ${refreshing ? 'opacity-50' : ''}`}>
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Sync</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="relative flex-grow group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70" size={16} />
                <input 
                  type="text" 
                  placeholder="Type exact model (e.g. Book 5)" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-black/20 backdrop-blur-md border border-white/10 rounded-[16px] pl-10 pr-4 py-3 text-[14px] font-medium text-white focus:outline-none focus:bg-black/40 focus:border-white/30 shadow-inner placeholder:text-white/30 transition-all" 
                />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center justify-center w-[48px] rounded-[16px] active:scale-95 transition-all shadow-sm ${showFilters ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'}`}>
                <SlidersHorizontal size={16} />
                {activeFilterCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-black/80">{activeFilterCount}</span>}
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
              <button onClick={() => setActiveCategory('All')} className={`px-4 py-2 rounded-full transition-colors font-bold text-[12px] shadow-sm flex-shrink-0 ${activeCategory === 'All' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'}`}>All Models</button>
              {modelCategories.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-full transition-colors font-bold text-[12px] shadow-sm flex-shrink-0 ${activeCategory === cat ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'}`}>{cat}</button>)}
            </div>

            {showFilters && (
              <div className="mt-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-[20px] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Hardware Refinement</p>
                  {activeFilterCount > 0 && <button onClick={resetFilters} className="text-red-400 hover:text-red-300 px-2 py-1 font-bold text-[12px] transition-colors">Reset</button>}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">Processor</p>
                    <FilterSelect label="CPU" value={filters.processor} options={filterOptions.processor} onChange={(v) => setFilters({...filters, processor: v})} icon={<Tag size={12} />} />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">RAM</p>
                     <FilterSelect label="RAM" value={filters.ram} options={filterOptions.ram} onChange={(v) => setFilters({...filters, ram: v})} />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">Storage</p>
                     <FilterSelect label="SSD" value={filters.ssd} options={filterOptions.ssd} onChange={(v) => setFilters({...filters, ssd: v})} />
                  </div>
                </div>
                <button onClick={() => setShowFilters(false)} className="w-full py-4 bg-white text-black rounded-[20px] font-bold text-[15px] hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
                  Show {processedData.length} Results
                </button>
              </div>
            )}
          </header>

          <main className="space-y-6">
            <div className="flex justify-between items-center px-1">
               <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2">Inventory: {processedData.length} Devices</p>
               {(searchTerm || activeFilterCount > 0) && <button onClick={() => {setSearchTerm(''); resetFilters(); setActiveCategory('All');}} className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest hover:underline">Reset View</button>}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md p-4 rounded-[20px] shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
                <ServerCrash size={18} className="text-red-400 mt-1" />
                <div><p className="text-[14px] font-bold text-white">Error</p><p className="text-[12px] font-medium text-red-300 mt-0.5">{error}</p></div>
              </div>
            )}

            {processedData.length > 0 ? (
              <div className="space-y-6">
                {processedData.map((laptop, index) => <LiquidGlassCard key={`${laptop['SKU CODE']}-${index}`} item={laptop} onToast={showToast} />)}
              </div>
            ) : (
              <div className="text-center py-24 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in fade-in duration-500">
                <div className="h-16 w-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="h-8 w-8 text-white/50" /></div>
                <p className="text-[24px] font-bold text-white mb-2 drop-shadow-md">No Exact Match</p>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Strict matching active</p>
              </div>
            )}
          </main>

        </div>
      </div>
      
      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-white/10 backdrop-blur-2xl border border-white/20 text-white text-[14px] font-bold rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-4 duration-300">{toast}</div>}
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </div>
  );
}

const FilterSelect = ({ label, value, options, onChange, icon }) => (
  <div className="relative group">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70">
      {icon || <Circle size={10} fill={value ? "currentColor" : "none"} />}
    </div>
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      className="w-full bg-black/20 backdrop-blur-md border border-white/10 rounded-[16px] pl-10 pr-10 py-3 text-[14px] font-medium text-white focus:outline-none focus:bg-black/40 focus:border-white/30 shadow-inner appearance-none transition-all"
    >
      <option value="" className="bg-[#0a0a0a] text-white">{label} (All)</option>
      {options.map((opt, i) => <option key={i} value={opt} className="bg-[#0a0a0a] text-white">{opt}</option>)}
    </select>
    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none group-focus-within:rotate-180 transition-transform duration-300" />
  </div>
);

function LiquidGlassCard({ item, onToast }) {
  const [expanded, setExpanded] = useState(false);
  const [useBankOffer, setUseBankOffer] = useState(false);
  const [useUpgrade, setUseUpgrade] = useState(false);

  const name = item['Marketing Name'] || item['Model'] || 'Unknown Device';
  const sku = item['SKU CODE'] || item['SKU'] || 'N/A';
  const colors = (item['Color'] || '').split(',').map(c => c.trim()).filter(Boolean);
  
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
    <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden relative transition-all duration-300">
      
      <div className="p-5 flex gap-4 items-start relative z-10">
        <div className="h-16 w-16 bg-white/5 backdrop-blur-md border border-white/10 rounded-[20px] flex items-center justify-center flex-shrink-0">
          <Laptop className="h-8 w-8 text-white/70" />
        </div>
        <div className="flex-grow min-w-0 pt-1">
          <p onClick={() => copyToClipboard(sku, () => onToast('SKU Copied!'))} className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1 select-text cursor-pointer hover:text-white transition-colors">{sku}</p>
          <h2 className="text-[16px] sm:text-[18px] font-bold text-white leading-tight pr-1 line-clamp-2">{name}</h2>
          <p className="text-[14px] text-white/80 mt-1.5 truncate">{item['Processor']} | {item['RAM']} | {item['SSD']}</p>
        </div>
      </div>

      <div className="px-5 pb-5 relative z-10">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[20px] p-4">
          <div className="flex justify-between items-center mb-4 px-1">
            <div>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">MOP</p>
              <span className={`block text-[16px] font-bold ${support > 0 ? 'line-through text-white/50' : 'text-white'}`}>₹{formatINR(mop)}</span>
            </div>
            {support > 0 && <div className="text-right">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Support</p>
              <span className="block text-[16px] font-bold text-emerald-400">-₹{formatINR(support)}</span>
            </div>}
          </div>
          
          <div className="flex flex-col gap-2 mb-4">
            {bankCb > 0 && (
              <button onClick={() => setUseBankOffer(!useBankOffer)} className={`w-full flex items-center justify-between px-4 py-3 rounded-[16px] text-[14px] font-medium transition-all active:scale-95 ${useBankOffer ? 'bg-white/10 border border-white/30 text-white shadow-inner' : 'bg-black/20 border border-white/10 text-white/70 hover:bg-black/40'}`}>
                <div className="flex items-center gap-3"><CreditCard size={16} /><span>Bank Offer</span></div>
                <div className="flex items-center gap-2"><span>-₹{formatINR(bankCb)}</span>{useBankOffer ? <CheckCircle2 size={16} className="text-white"/> : <Circle size={16} className="text-white/30"/>}</div>
              </button>
            )}
            {upgrade > 0 && (
              <button onClick={() => setUseUpgrade(!useUpgrade)} className={`w-full flex items-center justify-between px-4 py-3 rounded-[16px] text-[14px] font-medium transition-all active:scale-95 ${useUpgrade ? 'bg-white/10 border border-white/30 text-white shadow-inner' : 'bg-black/20 border border-white/10 text-white/70 hover:bg-black/40'}`}>
                <div className="flex items-center gap-3"><Tag size={16} /><span>Upgrade Bonus</span></div>
                <div className="flex items-center gap-2"><span>-₹{formatINR(upgrade)}</span>{useUpgrade ? <CheckCircle2 size={16} className="text-white"/> : <Circle size={16} className="text-white/30"/>}</div>
              </button>
            )}
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[20px] px-5 py-4 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div>
              <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-1">Final Price</p>
              <span className="text-[24px] font-bold text-white">₹{formatINR(offerPrice)}</span>
            </div>
            <div className="h-12 w-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
              <Laptop size={20} className="text-white/70" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 flex justify-between items-center relative z-10">
        <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[50%]">
          {colors.length > 0 ? colors.map((c, i) => (
             <span key={i} className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[12px] font-bold text-white/80 whitespace-nowrap">{c}</span>
          )) : <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[12px] font-bold text-white/50">Standard</span>}
        </div>
        <div className="flex gap-2">
          {navigator.share && <button onClick={() => { navigator.share({ title: 'Quote', text: `*Galaxy Book: ${name}*\nOffer Price: ₹${formatINR(offerPrice)}\nSKU: ${sku}` }).catch(() => copyToClipboard(getShareText(), () => onToast('Copied!'))); }} className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full hover:bg-white/20 transition-colors font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 active:scale-95"><Share2 size={14} /><span className="hidden sm:inline">Share</span></button>}
          <button onClick={() => copyToClipboard(getShareText(), () => onToast('Quotation Copied!'))} className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full hover:bg-white/20 transition-colors font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 active:scale-95"><Copy size={14} /><span className="hidden sm:inline">Copy</span></button>
          <button onClick={() => setExpanded(!expanded)} className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full hover:bg-white/20 transition-colors font-bold text-[12px] shadow-sm flex items-center justify-center gap-1.5 active:scale-95">Specs <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
        </div>
      </div>

      {expanded && (
        <div className="px-6 pb-6 pt-4 bg-white/5 border-t border-white/10 backdrop-blur-md">
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(item).map(([k, v], i) => {
              if (!v || v === 'N/A' || ['Marketing Name', 'Model', 'Name', 'MOP', 'Support', 'Bank CB', 'Upgrade', 'Color', 'SKU CODE'].some(key => k.toLowerCase().includes(key.toLowerCase()))) return null;
              return (
                <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{k}</span>
                  <span className="text-[14px] font-bold text-white text-right w-2/3 truncate">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Laptop, ChevronDown, ChevronUp, AlertTriangle, 
  Loader2, CreditCard, Copy, Share2, ServerCrash, 
  CheckCircle2, Circle, SlidersHorizontal, X, Tag
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
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      if (char === '\r') i++;
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || csvText[csvText.length - 1] === ',') {
    currentRow.push(currentCell.trim());
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  return rows;
};

const parsePrice = (priceStr) => {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  const numStr = priceStr.replace(/[^0-9]/g, '');
  const num = parseInt(numStr, 10);
  return isNaN(num) ? 0 : num;
};

const formatINR = (num) => {
  if (num === 0 || isNaN(num)) return 'N/A';
  return num.toLocaleString('en-IN');
};

const cleanHeaderName = (headerStr) => {
  if (!headerStr) return '';
  return headerStr.replace(/^\(\s*[A-Za-z]\s*\)\s*/, '').trim();
};

const fallbackCopyTextToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed"; 
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    alert('Details Copied Successfully!');
  } catch (err) {
    alert('Failed to copy. Please copy manually.');
  }
  document.body.removeChild(textArea);
};

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ ram: '', ssd: '', displaySize: '', displayType: '' });

  // Fetch Data
  useEffect(() => {
    const fetchSheetData = async () => {
      const sheetCSVUrl = 'https://docs.google.com/spreadsheets/d/122AONXEgWNyc4EnWupTeLMwrLbbXsFy2/export?format=csv&gid=1160082038';
      
      try {
        const response = await fetch(sheetCSVUrl);
        if (!response.ok) throw new Error('Network response failed.');
        
        const text = await response.text();
        if (text.trim().startsWith('<')) throw new Error("Received HTML. Ensure sheet is published.");

        const rows = parseCSV(text);
        
        if (rows.length > 1) {
          const headers = rows[0] || [];
          
          const jsonData = rows.slice(1).map(row => {
            let obj = {};
            headers.forEach((header, i) => {
              if (i >= 1 && i <= 26 && i !== 5 && i !== 7 && i !== 9) {
                const keyName = cleanHeaderName((header || `Column_${i}`).trim()); 
                const cellValue = row[i] ? row[i].trim() : '';
                if (keyName) obj[keyName] = cellValue;
              }
            });
            return obj;
          });
          
          const validData = jsonData.filter(item => item['Marketing Name'] || item['Model'] || item['SKU CODE']);
          setData(validData);
        } else {
          throw new Error("Sheet is empty.");
        }
      } catch (err) {
        console.error("Fetch Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSheetData();
  }, []);

  // Filter Options
  const filterOptions = useMemo(() => {
    const options = { ram: new Set(), ssd: new Set(), displaySize: new Set(), displayType: new Set() };
    if (Array.isArray(data)) {
      data.forEach(item => {
        const ramKey = Object.keys(item).find(k => k.toLowerCase() === 'ram' || k.toLowerCase() === 'memory');
        const ssdKey = Object.keys(item).find(k => k.toLowerCase() === 'ssd' || k.toLowerCase() === 'storage');
        const dSizeKey = Object.keys(item).find(k => k.toLowerCase().includes('display size') || k.toLowerCase().includes('screen size'));
        const dTypeKey = Object.keys(item).find(k => k.toLowerCase().includes('display type') || k.toLowerCase().includes('screen type') || k === 'Display');

        if (ramKey && item[ramKey] && item[ramKey] !== 'N/A') options.ram.add(item[ramKey]);
        if (ssdKey && item[ssdKey] && item[ssdKey] !== 'N/A') options.ssd.add(item[ssdKey]);
        if (dSizeKey && item[dSizeKey] && item[dSizeKey] !== 'N/A') options.displaySize.add(item[dSizeKey]);
        if (dTypeKey && item[dTypeKey] && item[dTypeKey] !== 'N/A') options.displayType.add(item[dTypeKey]);
      });
    }
    return {
      ram: [...options.ram].sort(), ssd: [...options.ssd].sort(), displaySize: [...options.displaySize].sort(), displayType: [...options.displayType].sort()
    };
  }, [data]);

  // Data Processing
  const processedData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.filter(item => {
      if (!item) return false;
      const searchableString = Object.values(item).map(val => String(val).toLowerCase()).join(' ');
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const searchMatch = searchWords.length === 0 || searchWords.every(word => searchableString.includes(word));
      
      const ramKey = Object.keys(item).find(k => k.toLowerCase() === 'ram' || k.toLowerCase() === 'memory');
      const ssdKey = Object.keys(item).find(k => k.toLowerCase() === 'ssd' || k.toLowerCase() === 'storage');
      const dSizeKey = Object.keys(item).find(k => k.toLowerCase().includes('display size') || k.toLowerCase().includes('screen size'));
      const dTypeKey = Object.keys(item).find(k => k.toLowerCase().includes('display type') || k.toLowerCase().includes('screen type') || k === 'Display');

      const ramMatch = !filters.ram || item[ramKey] === filters.ram;
      const ssdMatch = !filters.ssd || item[ssdKey] === filters.ssd;
      const dSizeMatch = !filters.displaySize || item[dSizeKey] === filters.displaySize;
      const dTypeMatch = !filters.displayType || item[dTypeKey] === filters.displayType;

      return searchMatch && ramMatch && ssdMatch && dSizeMatch && dTypeMatch;
    });
  }, [data, searchTerm, filters]);

  const activeFilterCount = Object.values(filters).filter(val => val !== '').length;
  const resetFilters = () => setFilters({ ram: '', ssd: '', displaySize: '', displayType: '' });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F5F9]">
        <div className="h-20 w-20 rounded-[2rem] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 rounded-[2rem] border-2 border-indigo-100/50"></div>
          <Laptop className="h-8 w-8 text-indigo-500 animate-pulse" strokeWidth={2} />
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-slate-100">
             <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
          </div>
        </div>
        <p className="font-bold text-slate-800 text-lg tracking-tight">Loading Laptops...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F8] text-slate-900 font-sans pb-10 selection:bg-indigo-100">
      
      {/* One UI Glassmorphic Header - Minimized */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-white shadow-sm px-4 pt-4 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Laptop size={16} className="text-indigo-600 drop-shadow-sm" strokeWidth={2.5} />
            <h1 className="font-bold text-xs tracking-widest text-slate-500 uppercase">Galaxy Book</h1>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex gap-2 relative">
            <div className="relative flex-grow group">
              <Search className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Find anything..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-transparent outline-none focus:border-indigo-100 focus:bg-white bg-slate-100/80 text-[13px] font-medium transition-all shadow-inner"
              />
            </div>
            
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center w-11 h-[2.6rem] rounded-xl transition-all relative ${
                showFilters || activeFilterCount > 0 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-white text-slate-600 shadow-sm border border-slate-100'
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={2.5} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Floating Filters Panel */}
          {showFilters && (
            <div className="mt-3 p-4 bg-white/90 backdrop-blur-xl border border-white rounded-2xl shadow-lg animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Smart Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <X size={10} strokeWidth={3} /> Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FilterSelect label="RAM" value={filters.ram} options={filterOptions.ram} onChange={(v) => setFilters({...filters, ram: v})} />
                <FilterSelect label="SSD" value={filters.ssd} options={filterOptions.ssd} onChange={(v) => setFilters({...filters, ssd: v})} />
                <FilterSelect label="Display Size" value={filters.displaySize} options={filterOptions.displaySize} onChange={(v) => setFilters({...filters, displaySize: v})} />
                <FilterSelect label="Display Type" value={filters.displayType} options={filterOptions.displayType} onChange={(v) => setFilters({...filters, displayType: v})} />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-white border-2 border-red-50 p-4 rounded-[1.5rem] shadow-sm flex items-start gap-3">
            <div className="bg-red-100 p-2 rounded-xl text-red-600"><ServerCrash size={20} /></div>
            <div>
              <p className="text-sm font-bold text-red-800">Sync Error</p>
              <p className="text-[11px] font-medium text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
           <p className="text-[13px] font-bold text-slate-400 tracking-wide">
             Showing <span className="text-slate-800">{processedData.length}</span> Results
           </p>
        </div>

        {processedData.length > 0 ? (
          <div className="space-y-6">
            {processedData.map((laptop, index) => {
              const uniqueKey = laptop['SKU CODE'] || laptop['SKU'] || index;
              return <FloatingOneUICard key={uniqueKey} item={laptop} />;
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.03)] border border-slate-100">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
              <AlertTriangle className="h-8 w-8 text-slate-300" strokeWidth={2} />
            </div>
            <p className="font-bold text-slate-800 text-lg">No matches found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting the filters.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Smooth Filter Select ---
const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-2.5 pr-7 py-2.5 text-[11px] font-bold border border-slate-100 rounded-xl outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 bg-slate-50 text-slate-700 appearance-none transition-all"
    >
      <option value="">{label} (All)</option>
      {options.map((opt, i) => (
        <option key={i} value={opt}>{opt}</option>
      ))}
    </select>
    <ChevronDown size={12} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
  </div>
);

// --- One UI 8.5 Floating Card ---
function FloatingOneUICard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [useBankOffer, setUseBankOffer] = useState(false);
  const [useUpgrade, setUseUpgrade] = useState(false);

  const name = item['Marketing Name'] || item['Model'] || item['Name'] || 'Unknown Device';
  const sku = item['SKU CODE'] || item['SKU'] || 'N/A';
  const ram = item['RAM'] || item['Memory'] || '';
  const ssd = item['SSD'] || item['Storage'] || '';
  const colors = (item['Color'] || '').split(',').map(c => c.trim()).filter(Boolean);
  
  const mop = parsePrice(item['MOP']);
  const support = parsePrice(item['Support'] || item['Sellout Support'] || item['Sellout']);
  const bankCb = parsePrice(item['Bank CB- HDFC'] || item['Bank CB (HDFC)'] || item['Bank CB']);
  const upgrade = parsePrice(item['Upgrade'] || item['Upgrade Price'] || item['Exchange']);

  const baseEffectivePrice = Math.max(0, mop - support);
  let finalEffectivePrice = baseEffectivePrice;
  if (useBankOffer) finalEffectivePrice -= bankCb;
  if (useUpgrade) finalEffectivePrice -= upgrade;
  finalEffectivePrice = Math.max(0, finalEffectivePrice);

  const getShareText = () => {
    let text = `*${name}*\nSKU: ${sku}\n\n`;
    text += `MOP: ₹${formatINR(mop)}\n`;
    if(support > 0) text += `Support: -₹${formatINR(support)}\n`;
    if(useBankOffer) text += `Bank Offer: -₹${formatINR(bankCb)}\n`;
    if(useUpgrade) text += `Upgrade: -₹${formatINR(upgrade)}\n`;
    
    text += `\n*Offer Price: ₹${formatINR(finalEffectivePrice)}*\n\nSpecs:\n`;
    Object.entries(item).forEach(([k, v]) => {
      if(v && v !== 'N/A' && !['Marketing Name', 'MOP', 'Support', 'Bank CB- HDFC', 'Upgrade'].includes(k)) {
         text += `• ${k}: ${v}\n`;
      }
    });
    return text;
  };

  const handleCopy = () => fallbackCopyTextToClipboard(getShareText());
  const handleShare = async () => {
    const text = getShareText();
    if (navigator.share) {
      try { await navigator.share({ title: 'SamAssist Device Info', text: text }); } 
      catch (err) { console.log('Share canceled'); }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-white rounded-[1.5rem] shadow-[0_6px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)] border border-white transition-shadow duration-500 overflow-hidden relative">
      
      {/* Glossy Top Highlight */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>

      {/* Main Header */}
      <div className="p-4 pb-2 flex gap-3 items-start relative z-10">
        {/* 3D Simulated Icon */}
        <div className="h-12 w-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl shadow-[inset_0_-1px_4px_rgba(0,0,0,0.02),0_4px_8px_rgba(0,0,0,0.04)] border border-white flex items-center justify-center flex-shrink-0">
           <Laptop className="h-5 w-5 text-indigo-500 drop-shadow-sm" strokeWidth={2} />
        </div>

        <div className="flex-grow min-w-0 pt-0.5">
          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em] mb-0.5">{sku}</p>
          <h2 className="text-[15px] font-black text-slate-800 leading-tight pr-1 line-clamp-2">{name}</h2>
          {(ram || ssd) && (
            <p className="text-[11px] font-semibold text-slate-400 mt-1 truncate">
              {ram && ssd ? `${ram} | ${ssd}` : (ram || ssd)}
            </p>
          )}
        </div>
      </div>

      {/* Interactive Pricing Engine (One UI Style) */}
      <div className="px-4 pb-3">
        <div className="bg-[#F8F9FB] rounded-[1.2rem] p-3 border border-slate-100/80">
          
          <div className="flex justify-between items-center mb-2 px-1">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MOP</span>
              <span className={`block text-[13px] font-black mt-0.5 ${support > 0 ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                ₹{formatINR(mop)}
              </span>
            </div>
            {support > 0 && (
              <div className="text-right">
                 <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Support</span>
                 <span className="block text-[13px] font-black text-emerald-600 mt-0.5">-₹{formatINR(support)}</span>
              </div>
            )}
          </div>

          {/* Interactive Squircle Toggles */}
          {(bankCb > 0 || upgrade > 0) && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/60">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Active Offers</p>
              <div className="flex flex-col gap-1.5">
                {bankCb > 0 && (
                  <button 
                    onClick={() => setUseBankOffer(!useBankOffer)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-300 active:scale-[0.98] ${
                      useBankOffer ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.2)] border-transparent' : 'bg-white text-slate-600 shadow-sm border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className={useBankOffer ? 'text-blue-200' : 'text-slate-400'} />
                      <span>Bank Cashback</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={useBankOffer ? 'text-white' : 'text-blue-600'}>-₹{formatINR(bankCb)}</span>
                      {useBankOffer ? <CheckCircle2 size={14} fill="white" className="text-blue-600"/> : <Circle size={14} className="text-slate-300"/>}
                    </div>
                  </button>
                )}
                
                {upgrade > 0 && (
                  <button 
                    onClick={() => setUseUpgrade(!useUpgrade)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-300 active:scale-[0.98] ${
                      useUpgrade ? 'bg-orange-500 text-white shadow-[0_4px_15px_rgba(249,115,22,0.2)] border-transparent' : 'bg-white text-slate-600 shadow-sm border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag size={14} className={useUpgrade ? 'text-orange-200' : 'text-slate-400'} />
                      <span>Upgrade Bonus</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={useUpgrade ? 'text-white' : 'text-orange-600'}>-₹{formatINR(upgrade)}</span>
                      {useUpgrade ? <CheckCircle2 size={14} fill="white" className="text-orange-500"/> : <Circle size={14} className="text-slate-300"/>}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Premium Final Price Display */}
          <div className="mt-3 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl px-4 py-3 flex items-center justify-between shadow-md text-white">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Offer Price</span>
              <span className="text-xl font-black tracking-tight">₹{formatINR(finalEffectivePrice)}</span>
            </div>
            <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
               <Laptop size={14} className="text-white/80" />
            </div>
          </div>

        </div>
      </div>

      {/* Colors & Expand Actions */}
      <div className="px-4 pb-4 flex justify-between items-center">
        <div className="flex flex-wrap gap-1.5">
          {colors.length > 0 ? colors.map((c, i) => (
            <span key={i} className="px-2 py-0.5 bg-slate-100/80 border border-slate-200/60 rounded-md text-[10px] font-bold text-slate-600">
              {c}
            </span>
          )) : <span className="text-[10px] text-slate-400 font-medium">Standard Colors</span>}
        </div>
        
        <div className="flex gap-1.5">
          <button onClick={handleShare} className="h-8 w-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
            <Share2 size={12} />
          </button>
          <button onClick={handleCopy} className="h-8 w-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
            <Copy size={12} />
          </button>
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 active:scale-95 transition-all"
          >
            {expanded ? 'Hide' : 'Specs'}
            <ChevronDown size={12} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded Specs List */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-100/50">
          <div className="grid grid-cols-1 gap-2 mt-1">
            {Object.entries(item).map(([key, value], idx) => {
              const hideKeys = ['Marketing Name', 'Model', 'Name', 'MOP', 'Support', 'Bank CB- HDFC', 'Bank CB', 'Upgrade', 'Color', 'SKU CODE'];
              if (!value || value === 'N/A' || hideKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) return null;
              
              return (
                <div key={idx} className="flex flex-col border-b border-slate-200/50 pb-1.5 last:border-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{key}</span>
                  <span className="text-[12px] font-bold text-slate-800 break-words">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
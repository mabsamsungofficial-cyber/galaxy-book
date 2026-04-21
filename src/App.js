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
  const [activeCategory, setActiveCategory] = useState('All'); // New State for Pill Categories
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

  // Smart Categories Extractor (Extracts Book 6, Book 5 etc. automatically)
  const modelCategories = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const books = new Set();
    
    data.forEach(item => {
      const name = String(item['Marketing Name'] || item['Model'] || item['Name'] || '');
      // Match pattern like "Book 4", "Book4", "Book 6", "Book6"
      const match = name.match(/book\s*(\d+)/i);
      if (match) {
        books.add(`Book ${match[1]}`); // Normalize to "Book X"
      }
    });
    
    // Convert to array and sort descending (Latest first)
    return Array.from(books).sort((a, b) => {
      const numA = parseInt(a.replace('Book ', ''));
      const numB = parseInt(b.replace('Book ', ''));
      return numB - numA;
    });
  }, [data]);

  // Filter Options for Smart Filters panel
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

  // Data Processing (Search + Dropdowns + Pill Categories)
  const processedData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.filter(item => {
      if (!item) return false;
      const name = String(item['Marketing Name'] || item['Model'] || item['Name'] || '');
      
      // 1. Search Match
      const searchableString = Object.values(item).map(val => String(val).toLowerCase()).join(' ');
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const searchMatch = searchWords.length === 0 || searchWords.every(word => searchableString.includes(word));
      
      // 2. Pill Category Match
      let categoryMatch = true;
      if (activeCategory !== 'All') {
        const match = name.match(/book\s*(\d+)/i);
        if (match) {
          categoryMatch = `Book ${match[1]}` === activeCategory;
        } else {
          categoryMatch = false; // Doesn't have a book number
        }
      }

      // 3. Dropdown Filters Match
      const ramKey = Object.keys(item).find(k => k.toLowerCase() === 'ram' || k.toLowerCase() === 'memory');
      const ssdKey = Object.keys(item).find(k => k.toLowerCase() === 'ssd' || k.toLowerCase() === 'storage');
      const dSizeKey = Object.keys(item).find(k => k.toLowerCase().includes('display size') || k.toLowerCase().includes('screen size'));
      const dTypeKey = Object.keys(item).find(k => k.toLowerCase().includes('display type') || k.toLowerCase().includes('screen type') || k === 'Display');

      const ramMatch = !filters.ram || item[ramKey] === filters.ram;
      const ssdMatch = !filters.ssd || item[ssdKey] === filters.ssd;
      const dSizeMatch = !filters.displaySize || item[dSizeKey] === filters.displaySize;
      const dTypeMatch = !filters.displayType || item[dTypeKey] === filters.displayType;

      return searchMatch && categoryMatch && ramMatch && ssdMatch && dSizeMatch && dTypeMatch;
    });
  }, [data, searchTerm, filters, activeCategory]);

  const activeFilterCount = Object.values(filters).filter(val => val !== '').length;
  const resetFilters = () => setFilters({ ram: '', ssd: '', displaySize: '', displayType: '' });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] relative">
        {/* Animated Background Orbs */}
        <div className="absolute top-[20%] left-[20%] w-64 h-64 bg-indigo-400/30 rounded-full blur-[80px] animate-pulse"></div>
        <div className="absolute bottom-[20%] right-[20%] w-72 h-72 bg-purple-400/30 rounded-full blur-[80px] animate-pulse" style={{animationDelay: '1s'}}></div>
        
        {/* Liquid Glass Loading Card */}
        <div className="h-24 w-24 rounded-[28px] bg-white/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.9)] border border-white/60 flex flex-col items-center justify-center mb-6 relative z-10 transition-transform duration-500 ease-out hover:scale-105">
          <Laptop className="h-8 w-8 text-indigo-600 animate-pulse drop-shadow-md" strokeWidth={2} />
          <div className="absolute -bottom-2 -right-2 bg-white/80 backdrop-blur-md rounded-full p-1.5 shadow-sm border border-white/60">
             <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
          </div>
        </div>
        <p className="font-bold text-slate-700 text-lg tracking-tight relative z-10">Loading Laptops...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-800 font-sans pb-10 selection:bg-indigo-200 relative">
      
      {/* --- VIBRANT BACKGROUND ORBS (For Liquid Glass Effect) --- */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-400/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-cyan-400/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] h-[60vw] bg-purple-400/15 rounded-full blur-[120px]"></div>
      </div>
      
      {/* --- LIQUID GLASS HEADER --- */}
      <header className="sticky top-0 z-50 bg-white/40 backdrop-blur-[40px] shadow-[0_4px_30px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.6)] border-b border-white/50 px-4 pt-4 pb-2">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-xl shadow-[0_2px_10px_rgba(99,102,241,0.4)]">
               <Laptop size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="font-bold text-xs tracking-widest text-slate-600 uppercase drop-shadow-sm">Galaxy Book</h1>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex gap-2 relative">
            <div className="relative flex-grow group">
              <Search className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Find anything..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[20px] border border-white/60 outline-none focus:border-indigo-300 focus:bg-white/80 bg-white/50 backdrop-blur-md text-[13px] font-semibold text-slate-800 placeholder-slate-500 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
              />
            </div>
            
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center w-11 h-[2.6rem] rounded-[20px] transition-all duration-300 active:scale-90 relative ${
                showFilters || activeFilterCount > 0 
                  ? 'bg-indigo-600/90 text-white shadow-[0_4px_15px_rgba(79,70,229,0.4)] border border-indigo-400/50' 
                  : 'bg-white/50 backdrop-blur-md text-slate-600 shadow-sm border border-white/60 hover:bg-white/70'
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={2.5} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-white/50 shadow-sm">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Dynamic Model Category Pills (Scrollable) */}
          {modelCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-3 -mx-4 px-4 scroll-smooth" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
              <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
              
              <button
                onClick={() => setActiveCategory('All')}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all duration-300 active:scale-95 ${
                  activeCategory === 'All'
                    ? 'bg-slate-800/90 backdrop-blur-md text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)] border border-slate-700/50'
                    : 'bg-white/50 backdrop-blur-md text-slate-600 shadow-sm border border-white/60 hover:bg-white/70'
                }`}
              >
                All Models
              </button>
              
              {modelCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-bold transition-all duration-300 active:scale-95 ${
                    activeCategory === cat
                      ? 'bg-slate-800/90 backdrop-blur-md text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)] border border-slate-700/50'
                      : 'bg-white/50 backdrop-blur-md text-slate-600 shadow-sm border border-white/60 hover:bg-white/70'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Floating Filters Panel */}
          {showFilters && (
            <div className="mt-2 p-4 bg-white/60 backdrop-blur-[30px] border border-white/60 rounded-[24px] shadow-[0_15px_40px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,0.8)] animate-in slide-in-from-top-4 fade-in duration-300 mb-2">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest drop-shadow-sm">Smart Filters</span>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="text-[10px] font-bold text-red-500 bg-red-50/80 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-red-100/50">
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

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-4 space-y-5">
        {error && (
          <div className="bg-red-50/80 backdrop-blur-xl border border-red-200/60 p-4 rounded-[24px] shadow-sm flex items-start gap-3">
            <div className="bg-red-100/80 p-2 rounded-2xl text-red-600"><ServerCrash size={18} /></div>
            <div>
              <p className="text-sm font-bold text-red-800">Sync Error</p>
              <p className="text-[11px] font-medium text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
           <p className="text-[12px] font-bold text-slate-500 tracking-wide drop-shadow-sm">
             Showing <span className="text-indigo-600 font-black">{processedData.length}</span> Results
           </p>
        </div>

        {processedData.length > 0 ? (
          <div className="space-y-5">
            {processedData.map((laptop, index) => {
              const uniqueKey = laptop['SKU CODE'] || laptop['SKU'] || index;
              return <LiquidGlassCard key={uniqueKey} item={laptop} />;
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white/40 backdrop-blur-2xl rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,0.8)] border border-white/60">
            <div className="h-16 w-16 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-4 border border-white shadow-sm">
              <AlertTriangle className="h-7 w-7 text-slate-400" strokeWidth={2} />
            </div>
            <p className="font-bold text-slate-700 text-lg">No matches found</p>
            <p className="text-sm text-slate-500 mt-1">Try adjusting the filters.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Liquid Glass Filter Select ---
const FilterSelect = ({ label, value, options, onChange }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full pl-3 pr-7 py-2.5 text-[11px] font-bold border border-white/60 rounded-[16px] outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100/50 bg-white/50 backdrop-blur-md text-slate-700 appearance-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
    >
      <option value="">{label} (All)</option>
      {options.map((opt, i) => (
        <option key={i} value={opt}>{opt}</option>
      ))}
    </select>
    <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
  </div>
);

// --- 🍎 iOS 26 LIQUID GLASS CARD COMPONENT 🍎 ---
function LiquidGlassCard({ item }) {
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
      try { await navigator.share({ title: 'Galaxy Book Info', text: text }); } 
      catch (err) { console.log('Share canceled'); }
    } else {
      handleCopy();
    }
  };

  return (
    // LIQUID GLASS CONTAINER
    <div className="bg-white/40 backdrop-blur-[40px] rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(255,255,255,1)] border border-white/50 transition-all duration-500 ease-out active:scale-[0.96] overflow-hidden relative">
      
      {/* Glossy Top Highlight overlay */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/50 to-transparent pointer-events-none"></div>

      {/* 1. Main Header */}
      <div className="p-4 pb-2 flex gap-3 items-start relative z-10">
        {/* Vibrant Simulated 3D Icon */}
        <div className="h-14 w-14 bg-white/60 backdrop-blur-md rounded-[18px] shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05),0_4px_8px_rgba(0,0,0,0.05)] border border-white flex items-center justify-center flex-shrink-0">
           <Laptop className="h-6 w-6 text-indigo-600 drop-shadow-sm" strokeWidth={2} />
        </div>

        <div className="flex-grow min-w-0 pt-1">
          <p className="text-[9px] font-black text-indigo-600/80 uppercase tracking-[0.15em] mb-0.5 drop-shadow-sm">{sku}</p>
          <h2 className="text-[16px] font-black text-slate-800 leading-tight pr-1 line-clamp-2">{name}</h2>
          {(ram || ssd) && (
            <p className="text-[11px] font-bold text-slate-500 mt-1 truncate">
              {ram && ssd ? `${ram} | ${ssd}` : (ram || ssd)}
            </p>
          )}
        </div>
      </div>

      {/* 2. Interactive Pricing Engine */}
      <div className="px-4 pb-3 relative z-10">
        {/* Inner Glass Box */}
        <div className="bg-white/30 backdrop-blur-md rounded-[24px] p-3 border border-white/40 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          
          <div className="flex justify-between items-center mb-2 px-1">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest drop-shadow-sm">MOP</span>
              <span className={`block text-[14px] font-black mt-0.5 ${support > 0 ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                ₹{formatINR(mop)}
              </span>
            </div>
            {support > 0 && (
              <div className="text-right">
                 <span className="text-[9px] font-black text-emerald-600/80 uppercase tracking-widest drop-shadow-sm">Support</span>
                 <span className="block text-[14px] font-black text-emerald-700 mt-0.5">-₹{formatINR(support)}</span>
              </div>
            )}
          </div>

          {/* Squirclic Toggles */}
          {(bankCb > 0 || upgrade > 0) && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-300/30">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Active Offers</p>
              <div className="flex flex-col gap-1.5">
                {bankCb > 0 && (
                  <button 
                    onClick={() => setUseBankOffer(!useBankOffer)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[16px] text-[12px] font-bold transition-all duration-400 ease-out active:scale-95 ${
                      useBankOffer ? 'bg-blue-500/90 backdrop-blur-md text-white shadow-[0_4px_15px_rgba(59,130,246,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-blue-400/50' : 'bg-white/60 backdrop-blur-sm text-slate-700 shadow-sm border border-white hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className={useBankOffer ? 'text-blue-100' : 'text-slate-500'} />
                      <span>Bank Cashback</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={useBankOffer ? 'text-white font-black' : 'text-blue-700'}>-₹{formatINR(bankCb)}</span>
                      {useBankOffer ? <CheckCircle2 size={14} fill="white" className="text-blue-500"/> : <Circle size={14} className="text-slate-300"/>}
                    </div>
                  </button>
                )}
                
                {upgrade > 0 && (
                  <button 
                    onClick={() => setUseUpgrade(!useUpgrade)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[16px] text-[12px] font-bold transition-all duration-400 ease-out active:scale-95 ${
                      useUpgrade ? 'bg-orange-500/90 backdrop-blur-md text-white shadow-[0_4px_15px_rgba(249,115,22,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-orange-400/50' : 'bg-white/60 backdrop-blur-sm text-slate-700 shadow-sm border border-white hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Tag size={14} className={useUpgrade ? 'text-orange-100' : 'text-slate-500'} />
                      <span>Upgrade Bonus</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={useUpgrade ? 'text-white font-black' : 'text-orange-700'}>-₹{formatINR(upgrade)}</span>
                      {useUpgrade ? <CheckCircle2 size={14} fill="white" className="text-orange-500"/> : <Circle size={14} className="text-slate-300"/>}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Liquid Final Price Badge */}
          <div className="mt-3 bg-gradient-to-br from-indigo-600/90 to-purple-700/90 backdrop-blur-xl rounded-[20px] px-4 py-3 flex items-center justify-between shadow-[0_8px_20px_rgba(79,70,229,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] border border-indigo-400/30 text-white transition-all">
            <div>
              <span className="text-[9px] font-black text-indigo-100/80 uppercase tracking-[0.2em] block mb-0.5">Offer Price</span>
              <span className="text-xl font-black tracking-tight drop-shadow-md">₹{formatINR(finalEffectivePrice)}</span>
            </div>
            <div className="h-9 w-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]">
               <Laptop size={16} className="text-white drop-shadow-sm" />
            </div>
          </div>

        </div>
      </div>

      {/* 3. Actions & Expansion */}
      <div className="px-4 pb-4 flex justify-between items-center relative z-10">
        <div className="flex flex-wrap gap-1.5">
          {colors.length > 0 ? colors.map((c, i) => (
            <span key={i} className="px-2.5 py-1 bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm rounded-[10px] text-[10px] font-bold text-slate-600">
              {c}
            </span>
          )) : <span className="text-[10px] text-slate-400 font-medium ml-1 drop-shadow-sm">Standard Colors</span>}
        </div>
        
        <div className="flex gap-1.5">
          <button onClick={handleShare} className="h-8 w-8 bg-white/60 backdrop-blur-md border border-white shadow-sm rounded-[12px] flex items-center justify-center text-slate-600 hover:bg-white/80 active:scale-90 transition-all duration-300">
            <Share2 size={13} />
          </button>
          <button onClick={handleCopy} className="h-8 w-8 bg-white/60 backdrop-blur-md border border-white shadow-sm rounded-[12px] flex items-center justify-center text-slate-600 hover:bg-white/80 active:scale-90 transition-all duration-300">
            <Copy size={13} />
          </button>
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-[12px] text-[10px] font-bold text-slate-700 bg-white/60 backdrop-blur-md border border-white shadow-sm hover:bg-white/80 active:scale-90 transition-all duration-300"
          >
            {expanded ? 'Hide' : 'Specs'}
            <ChevronDown size={14} className={`transition-transform duration-400 ease-out ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4. Expanded Content Area */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 bg-white/20 border-t border-white/40 backdrop-blur-md relative z-10">
          <div className="grid grid-cols-1 gap-1.5 mt-1">
            {Object.entries(item).map(([key, value], idx) => {
              const hideKeys = ['Marketing Name', 'Model', 'Name', 'MOP', 'Support', 'Bank CB- HDFC', 'Bank CB', 'Upgrade', 'Color', 'SKU CODE'];
              if (!value || value === 'N/A' || hideKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) return null;
              
              return (
                <div key={idx} className="flex justify-between border-b border-slate-300/30 pb-1.5 pt-1 last:border-0">
                  <span className="text-[10px] font-bold text-slate-500 tracking-wide drop-shadow-sm">{key}</span>
                  <span className="text-[11px] font-black text-slate-800 text-right w-2/3 truncate">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

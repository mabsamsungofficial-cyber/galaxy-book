import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Laptop, ChevronDown, ChevronUp, AlertTriangle, 
  Loader2, Copy, Share2, ServerCrash, CheckCircle2, 
  Circle, SlidersHorizontal, X
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

// Extracted for performance: Fallback Copy logic
const fallbackCopyTextToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed"; 
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    alert('Details Copied!');
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
              // B=1, AA=26. Skip F(5), H(7), J(9)
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

  // Extract Unique Filter Options
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
      ram: [...options.ram].sort(),
      ssd: [...options.ssd].sort(),
      displaySize: [...options.displaySize].sort(),
      displayType: [...options.displayType].sort()
    };
  }, [data]);

  // Filter Data combining Advanced Search and Dropdowns
  const processedData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    return data.filter(item => {
      if (!item) return false;
      
      // Advanced Search Logic
      const searchableString = Object.values(item).map(val => String(val).toLowerCase()).join(' ');
      const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const searchMatch = searchWords.length === 0 || searchWords.every(word => searchableString.includes(word));
      
      // Dropdown Filters Match
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
        <p className="font-bold text-slate-800">Syncing Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-6">
      
      {/* Header & Search */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-30 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
            <Laptop size={18} />
          </div>
          <h1 className="font-black text-lg text-slate-900 tracking-tight leading-none">Galaxy Book</h1>
        </div>

        {/* Search Bar + Filter Toggle */}
        <div className="flex gap-2 relative">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Advance Search (eg: 'Book 16GB', 'Pro 512')..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50 text-sm transition-all"
            />
          </div>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors relative ${
              showFilters || activeFilterCount > 0 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expandable Smart Filters Panel */}
        {showFilters && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex justify-between items-center mb-2.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Smart Filters</span>
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="text-[10px] font-bold text-red-500 flex items-center gap-1 hover:underline">
                  <X size={12} /> Clear All
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

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2">
            <ServerCrash className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-800">Connection Error</p>
              <p className="text-[10px] text-red-600">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-1">
           <p className="text-xs font-bold text-slate-500">
             Showing <span className="text-indigo-600">{processedData.length}</span> Results
           </p>
        </div>

        {processedData.length > 0 ? (
          processedData.map((laptop, index) => {
            const uniqueKey = laptop['SKU CODE'] || laptop['SKU'] || index;
            return <InteractiveLaptopCard key={uniqueKey} item={laptop} />;
          })
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
            <AlertTriangle className="h-6 w-6 text-slate-400 mx-auto mb-2" />
            <p className="font-bold text-slate-600 text-sm">No Results Found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your filters or search term.</p>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Small Reusable Filter Dropdown Component ---
const FilterSelect = ({ label, value, options, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-2 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white text-slate-700 appearance-none"
  >
    <option value="">{label} (All)</option>
    {options.map((opt, i) => (
      <option key={i} value={opt}>{opt}</option>
    ))}
  </select>
);

// --- Minimalist Interactive Laptop Card ---
function InteractiveLaptopCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [useBankOffer, setUseBankOffer] = useState(false);
  const [useUpgrade, setUseUpgrade] = useState(false);

  // Basic Details
  const name = item['Marketing Name'] || item['Model'] || item['Name'] || 'Unknown Laptop';
  const sku = item['SKU CODE'] || item['SKU'] || 'N/A';
  const ram = item['RAM'] || item['Memory'] || '';
  const ssd = item['SSD'] || item['Storage'] || '';
  const colors = (item['Color'] || '').split(',').map(c => c.trim()).filter(Boolean);
  
  // Pricing
  const mop = parsePrice(item['MOP']);
  const support = parsePrice(item['Support'] || item['Sellout Support'] || item['Sellout']);
  const bankCb = parsePrice(item['Bank CB- HDFC'] || item['Bank CB (HDFC)'] || item['Bank CB']);
  const upgrade = parsePrice(item['Upgrade'] || item['Upgrade Price'] || item['Exchange']);

  const baseEffectivePrice = Math.max(0, mop - support);
  let finalEffectivePrice = baseEffectivePrice;
  
  if (useBankOffer) finalEffectivePrice -= bankCb;
  if (useUpgrade) finalEffectivePrice -= upgrade;
  finalEffectivePrice = Math.max(0, finalEffectivePrice);

  // Copy & Share Text Generator
  const getShareText = () => {
    let text = `*${name}*\nSKU: ${sku}\n\n`;
    text += `MOP: ₹${formatINR(mop)}\n`;
    if(support > 0) text += `Support: -₹${formatINR(support)}\n`;
    if(useBankOffer) text += `Bank Offer: -₹${formatINR(bankCb)}\n`;
    if(useUpgrade) text += `Upgrade: -₹${formatINR(upgrade)}\n`;
    
    text += `\n*Live Price: ₹${formatINR(finalEffectivePrice)}*\n\nSpecs:\n`;
    
    Object.entries(item).forEach(([k, v]) => {
      if(v && v !== 'N/A' && !['Marketing Name', 'MOP', 'Support', 'Bank CB- HDFC', 'Upgrade'].includes(k)) {
         text += `• ${k}: ${v}\n`;
      }
    });
    return text;
  };

  const handleCopy = () => {
    const text = getShareText();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => alert('Details Copied!'))
        .catch(() => fallbackCopyTextToClipboard(text));
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const handleShare = async () => {
    const text = getShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Galaxy Book Details', text: text });
      } catch (err) {
        console.log('Share error:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* 1. Header (Compact) */}
      <div className="p-3 pb-2 flex gap-3 items-start">
        <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
           <Laptop className="h-5 w-5 text-indigo-400" />
        </div>

        <div className="flex-grow min-w-0 pt-0.5">
          <div className="flex justify-between items-start">
            <h2 className="text-sm font-bold text-slate-800 leading-tight truncate pr-2">{name}</h2>
            <span className="text-[9px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">{sku}</span>
          </div>
          {(ram || ssd) && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {ram && ssd ? `${ram} | ${ssd}` : (ram || ssd)}
            </p>
          )}
        </div>
      </div>

      {/* 2. Compact Interactive Pricing */}
      <div className="px-3 pb-3">
        <div className="bg-slate-50/50 rounded-lg border border-slate-100 p-2.5">
          
          <div className="flex justify-between items-center text-xs mb-2">
            <div>
              <span className="text-slate-500">MOP: </span>
              <span className={`font-semibold ${support > 0 ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                ₹{formatINR(mop)}
              </span>
            </div>
            {support > 0 && (
              <div className="text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                Support: -₹{formatINR(support)}
              </div>
            )}
          </div>

          {/* Toggles (Pill style) */}
          {(bankCb > 0 || upgrade > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {bankCb > 0 && (
                <button 
                  onClick={() => setUseBankOffer(!useBankOffer)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    useBankOffer ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {useBankOffer ? <CheckCircle2 size={12}/> : <Circle size={12}/>}
                  Bank: -₹{formatINR(bankCb)}
                </button>
              )}
              {upgrade > 0 && (
                <button 
                  onClick={() => setUseUpgrade(!useUpgrade)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    useUpgrade ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  {useUpgrade ? <CheckCircle2 size={12}/> : <Circle size={12}/>}
                  Upg: -₹{formatINR(upgrade)}
                </button>
              )}
            </div>
          )}

          {/* Final Price Bar */}
          <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1.5">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">Live Price</span>
            <span className="text-lg font-black text-indigo-900">₹{formatINR(finalEffectivePrice)}</span>
          </div>

        </div>
      </div>

      {/* 3. Footer Actions (Compact) */}
      <div className="px-3 pb-3 flex justify-between items-center">
        <div className="flex gap-2">
          <button onClick={handleCopy} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors" title="Copy Details">
            <Copy size={14} />
          </button>
          <button onClick={handleShare} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors" title="Share Details">
            <Share2 size={14} />
          </button>
        </div>
        
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1.5 rounded-md hover:bg-slate-50"
        >
          {expanded ? 'Hide Specs' : 'View Specs'}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* 4. Specs Dropdown */}
      {expanded && (
        <div className="px-3 pb-3 pt-2 bg-slate-50 border-t border-slate-100 text-[11px]">
          {colors.length > 0 && (
            <div className="mb-2">
              <span className="font-bold text-slate-500 mr-1">Colors:</span>
              <span className="text-slate-700">{colors.join(', ')}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-1">
            {Object.entries(item).map(([key, value], idx) => {
              const hideKeys = ['Marketing Name', 'Model', 'Name', 'MOP', 'Support', 'Bank CB- HDFC', 'Bank CB', 'Upgrade', 'Color', 'SKU CODE'];
              if (!value || value === 'N/A' || hideKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) return null;
              
              return (
                <div key={idx} className="flex justify-between border-b border-slate-200/50 pb-0.5 last:border-0">
                  <span className="text-slate-500 font-medium">{key}</span>
                  <span className="font-semibold text-slate-800 text-right w-2/3 truncate">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
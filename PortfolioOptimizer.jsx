import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ScatterChart, Scatter, ZAxis, BarChart, Bar, Cell 
} from 'recharts';
import { 
  Upload, TrendingUp, Shield, Activity, Settings, 
  Download, RefreshCw, AlertCircle, FileText, ChevronRight, Search, Globe 
} from 'lucide-react';

/**
 * --- MPT MATH HELPER FUNCTIONS ---
 */

// Calculate simple daily returns: (Price_t - Price_t-1) / Price_t-1
const calculateReturns = (data, tickers) => {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    let validRow = true;
    tickers.forEach(ticker => {
      const prev = parseFloat(data[i - 1][ticker]);
      const curr = parseFloat(data[i][ticker]);
      if (isNaN(prev) || isNaN(curr) || prev === 0) {
        validRow = false;
      } else {
        row[ticker] = (curr - prev) / prev;
      }
    });
    if (validRow) returns.push(row);
  }
  return returns;
};

// Calculate Mean Returns and Covariance Matrix
const calculateStats = (returns, tickers) => {
  const n = returns.length;
  if (n === 0) return { means: {}, covMatrix: [] };

  // 1. Mean Returns (Annualized assuming 252 trading days)
  const means = {};
  tickers.forEach(t => {
    const sum = returns.reduce((acc, r) => acc + r[t], 0);
    means[t] = (sum / n) * 252;
  });

  // 2. Covariance Matrix (Annualized)
  const covMatrix = Array(tickers.length).fill(0).map(() => Array(tickers.length).fill(0));
  
  for (let i = 0; i < tickers.length; i++) {
    for (let j = 0; j < tickers.length; j++) {
      let sumProduct = 0;
      const t1 = tickers[i];
      const t2 = tickers[j];
      const mean1 = means[t1] / 252; // Daily mean for cov calculation
      const mean2 = means[t2] / 252;

      for (let k = 0; k < n; k++) {
        sumProduct += (returns[k][t1] - mean1) * (returns[k][t2] - mean2);
      }
      covMatrix[i][j] = (sumProduct / (n - 1)) * 252;
    }
  }

  return { means, covMatrix };
};

// Simulation Engine: Monte Carlo
const runSimulation = (stats, tickers, riskFreeRate, iterations = 2000) => {
  const results = [];
  const { means, covMatrix } = stats;

  for (let i = 0; i < iterations; i++) {
    // 1. Generate Random Weights
    let weights = tickers.map(() => Math.random());
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / sumWeights); // Normalize to sum to 1

    // 2. Portfolio Return
    let portReturn = 0;
    weights.forEach((w, idx) => {
      portReturn += w * means[tickers[idx]];
    });

    // 3. Portfolio Volatility (Std Dev)
    // Variance = w_transpose * CovMatrix * w
    let portVar = 0;
    for (let r = 0; r < tickers.length; r++) {
      for (let c = 0; c < tickers.length; c++) {
        portVar += weights[r] * weights[c] * covMatrix[r][c];
      }
    }
    const portVol = Math.sqrt(portVar);

    // 4. Sharpe Ratio
    const sharpe = (portReturn - riskFreeRate) / portVol;

    results.push({
      id: i,
      return: portReturn,
      volatility: portVol,
      sharpe: sharpe,
      weights: weights // Array matching tickers order
    });
  }

  return results;
};

// --- MOCK GENERATOR FOR FALLBACK ---
// Used when the PHP API is not available
const generateMockHistory = (tickers) => {
  const n = 252; // 1 year
  const data = [];
  const now = new Date();
  
  // Initialize random start prices
  const prices = {};
  tickers.forEach(t => prices[t] = 100 + Math.random() * 400); 

  for (let i = 0; i < n; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (n - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const row = { Date: dateStr };
    tickers.forEach(t => {
      // Geometric Brownian Motion-ish
      const volatility = 0.02; 
      const drift = 0.0005;
      const change = drift + (Math.random() - 0.5) * 2 * volatility;
      prices[t] = prices[t] * (1 + change);
      row[t] = prices[t];
    });
    data.push(row);
  }
  return data;
};


/**
 * --- MAIN COMPONENT ---
 */

const PortfolioOptimizer = () => {
  // State
  const [csvData, setCsvData] = useState([]);
  const [tickers, setTickers] = useState([]);
  const [riskFreeRate, setRiskFreeRate] = useState(0.02);
  const [iterations, setIterations] = useState(2500);
  const [simResults, setSimResults] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  
  // Ticker Input State
  const [tickerInput, setTickerInput] = useState("AAPL, MSFT, GOOG, TSLA");
  const [dataSourceMode, setDataSourceMode] = useState('sample'); // 'sample', 'upload', 'fetch'

  // Ref for file input
  const fileInputRef = useRef(null);

  // Sample Data Loader
  const loadSampleData = () => {
    // Mock historical prices for 4 assets over ~20 days to demo
    const mockData = [
      { Date: '2023-01-01', SPY: 380, TLT: 100, GLD: 170, BTC: 16500 },
      { Date: '2023-01-02', SPY: 382, TLT: 101, GLD: 171, BTC: 16600 },
      { Date: '2023-01-03', SPY: 381, TLT: 102, GLD: 172, BTC: 16700 },
      { Date: '2023-01-04', SPY: 385, TLT: 103, GLD: 171, BTC: 16800 },
      { Date: '2023-01-05', SPY: 383, TLT: 102, GLD: 170, BTC: 16900 },
      { Date: '2023-01-06', SPY: 389, TLT: 104, GLD: 173, BTC: 17000 },
      { Date: '2023-01-07', SPY: 390, TLT: 105, GLD: 174, BTC: 17200 },
      { Date: '2023-01-08', SPY: 392, TLT: 104, GLD: 175, BTC: 17400 },
      { Date: '2023-01-09', SPY: 395, TLT: 103, GLD: 176, BTC: 18000 },
      { Date: '2023-01-10', SPY: 396, TLT: 102, GLD: 177, BTC: 19000 },
      { Date: '2023-01-11', SPY: 398, TLT: 101, GLD: 178, BTC: 20000 },
      { Date: '2023-01-12', SPY: 399, TLT: 100, GLD: 179, BTC: 21000 },
      { Date: '2023-01-13', SPY: 400, TLT: 102, GLD: 180, BTC: 20500 },
      { Date: '2023-01-14', SPY: 395, TLT: 103, GLD: 181, BTC: 20800 },
      { Date: '2023-01-15', SPY: 398, TLT: 104, GLD: 182, BTC: 21200 },
      { Date: '2023-01-16', SPY: 405, TLT: 106, GLD: 180, BTC: 22000 },
      { Date: '2023-01-17', SPY: 410, TLT: 108, GLD: 179, BTC: 23000 },
      { Date: '2023-01-18', SPY: 408, TLT: 107, GLD: 178, BTC: 22500 },
      { Date: '2023-01-19', SPY: 406, TLT: 105, GLD: 180, BTC: 22800 },
      { Date: '2023-01-20', SPY: 412, TLT: 104, GLD: 182, BTC: 23500 },
    ];
    setCsvData(mockData);
    setTickers(['SPY', 'TLT', 'GLD', 'BTC']);
    setSimResults([]);
    setError(null);
  };

  // CSV Parser
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Assume format: Date, Asset1, Asset2...
        const assetTickers = headers.slice(1); 
        
        const parsedData = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length === headers.length) {
            const row = { Date: values[0] };
            assetTickers.forEach((t, idx) => {
              row[t] = parseFloat(values[idx + 1]);
            });
            parsedData.push(row);
          }
        }
        
        setTickers(assetTickers);
        setCsvData(parsedData);
        setSimResults([]);
        setError(null);
      } catch (err) {
        setError("Failed to parse CSV. Ensure format: Date, Ticker1, Ticker2...");
      }
    };
    reader.readAsText(file);
  };

  // Handler for Fetching Data (Real via PHP + Mock Fallback)
  const handleFetchTickers = async () => {
    const rawTickers = tickerInput
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    if (rawTickers.length < 2) {
      setError("Please enter at least 2 tickers to optimize a portfolio.");
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      const fetchedDataByTicker = {};
      const allDates = new Set();

      // Fetch each ticker from your PHP proxy
      for (const t of rawTickers) {
        const url = `https://www.aliazary.com/apps/mptlab/api.php?mode=json_data&symbol=${encodeURIComponent(t)}&range=1y`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while fetching ${t}`);
        }

        const json = await response.json();

        // Expecting Yahoo-style chart JSON
        const chart = json.chart;
        if (!chart || chart.error || !chart.result || !chart.result[0]) {
          throw new Error(`Unexpected data format for ${t}`);
        }

        const result = chart.result[0];
        const timestamps = result.timestamp || [];
        const quotes =
          result.indicators &&
          result.indicators.quote &&
          result.indicators.quote[0] &&
          result.indicators.quote[0].close
            ? result.indicators.quote[0].close
            : [];

        fetchedDataByTicker[t] = {};

        timestamps.forEach((ts, i) => {
          const price = quotes[i];
          if (price != null && !Number.isNaN(price)) {
            const dateStr = new Date(ts * 1000).toISOString().split("T")[0];
            fetchedDataByTicker[t][dateStr] = price;
            allDates.add(dateStr);
          }
        });
      }

      // Merge into array of rows: { Date, Ticker1, Ticker2, ... }
      const mergedRows = Array.from(allDates)
        .sort()
        .map(date => {
          const row = { Date: date };
          rawTickers.forEach(t => {
            const value = fetchedDataByTicker[t][date];
            row[t] = typeof value === "number" ? value : null;
          });
          return row;
        });

      if (mergedRows.length === 0) {
        throw new Error("No price data returned from API.");
      }

      setCsvData(mergedRows);
      setTickers(rawTickers);
      setSimResults([]);
    } catch (err) {
      console.error(err);
      setError("Error fetching real data. Falling back to simulated data.");

      // Fallback: use mock generator so the app still works
      const mockHistory = generateMockHistory(rawTickers);
      setCsvData(mockHistory);
      setTickers(rawTickers);
      setSimResults([]);
    } finally {
      setIsFetching(false);
    }
  };

  // Run Optimization
  const handleOptimize = () => {
    setIsSimulating(true);
    // Timeout to allow UI to render the loading state
    setTimeout(() => {
      try {
        const returns = calculateReturns(csvData, tickers);
        if (returns.length < 2) throw new Error("Not enough data points to calculate returns.");
        
        const stats = calculateStats(returns, tickers);
        const results = runSimulation(stats, tickers, riskFreeRate, iterations);
        setSimResults(results);
        setIsSimulating(false);
      } catch (err) {
        setError(err.message);
        setIsSimulating(false);
      }
    }, 100);
  };

  // Derived Optimal Portfolios
  const optimalPortfolios = useMemo(() => {
    if (simResults.length === 0) return null;
    
    const maxSharpe = simResults.reduce((prev, current) => 
      (prev.sharpe > current.sharpe) ? prev : current
    );
    
    const minVol = simResults.reduce((prev, current) => 
      (prev.volatility < current.volatility) ? prev : current
    );

    return { maxSharpe, minVol };
  }, [simResults]);

  // Color Scale for Charts
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="text-blue-500 w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">MPT<span className="text-blue-500">Lab</span></h1>
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 ml-2">v1.1</span>
          </div>
          <div className="flex gap-4 text-sm text-slate-400">
             <span>Modern Portfolio Theory Optimizer</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls & Input */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Data Source Selector */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4" /> Data Source
            </h2>
            
            {/* Mode Toggles */}
            <div className="flex p-1 bg-slate-900 rounded-lg mb-4">
              <button 
                onClick={() => setDataSourceMode('sample')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${dataSourceMode === 'sample' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Sample
              </button>
              <button 
                onClick={() => setDataSourceMode('fetch')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${dataSourceMode === 'fetch' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Fetch
              </button>
              <button 
                onClick={() => setDataSourceMode('upload')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${dataSourceMode === 'upload' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Upload
              </button>
            </div>

            {/* Mode Content */}
            <div className="space-y-4">
              
              {dataSourceMode === 'sample' && (
                <button 
                  onClick={loadSampleData}
                  className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Load Sample Data
                </button>
              )}

              {dataSourceMode === 'upload' && (
                <div>
                   <label className="block text-xs text-slate-500 mb-2">Upload CSV (Date, Ticker1, ...)</label>
                   <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                </div>
              )}

              {dataSourceMode === 'fetch' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tickers (comma separated)</label>
                    <input 
                      type="text" 
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value)}
                      placeholder="AAPL, MSFT, GOOG..."
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600 uppercase"
                    />
                  </div>
                  <button 
                    onClick={handleFetchTickers}
                    disabled={isFetching}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isFetching ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                    {isFetching ? "Fetching..." : "Fetch Data"}
                  </button>
                  <p className="text-[10px] text-slate-500 italic border-l-2 border-slate-600 pl-2">
                    Note: App will try to fetch real prices via <code>api.php</code>. If it fails, it automatically falls back to simulated data.
                  </p>
                </div>
              )}

            </div>
            
            {tickers.length > 0 && (
               <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-2">Current Universe ({tickers.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {tickers.map(t => (
                      <span key={t} className="text-xs bg-slate-900 border border-slate-600 text-slate-300 px-2 py-1 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
               </div>
            )}
          </div>

          {/* Parameters Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg">
             <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Parameters
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Risk-Free Rate (Annual)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    step="0.01" 
                    value={riskFreeRate} 
                    onChange={(e) => setRiskFreeRate(parseFloat(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Simulations</label>
                <input 
                  type="range" 
                  min="500" 
                  max="5000" 
                  step="100" 
                  value={iterations} 
                  onChange={(e) => setIterations(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>500</span>
                  <span className="text-blue-400">{iterations}</span>
                  <span>5000</span>
                </div>
              </div>

              <button 
                onClick={handleOptimize}
                disabled={tickers.length === 0 || isSimulating}
                className={`w-full py-3 rounded-lg font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                  tickers.length === 0 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/20'
                }`}
              >
                {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Run Optimization
              </button>
            </div>
          </div>
          
          {error && (
            <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-xl flex gap-3 items-start text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* CENTER & RIGHT: Visualization */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* Efficient Frontier Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-1 shadow-lg overflow-hidden relative min-h-[450px]">
            <div className="absolute top-4 left-4 z-10">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 Efficient Frontier 
                 {simResults.length > 0 && <span className="text-xs font-normal text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full">{simResults.length} Portfolios</span>}
               </h2>
               <p className="text-xs text-slate-400">Y-Axis: Expected Return | X-Axis: Volatility (Risk)</p>
            </div>
            
            {simResults.length > 0 ? (
              <ResponsiveContainer width="100%" height={450}>
                <ScatterChart margin={{ top: 60, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    type="number" 
                    dataKey="volatility" 
                    name="Volatility" 
                    unit="" 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickFormatter={(val) => `${(val * 100).toFixed(1)}%`}
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="return" 
                    name="Return" 
                    unit="" 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickFormatter={(val) => `${(val * 100).toFixed(1)}%`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-600 p-3 rounded shadow-xl text-xs">
                            <p className="font-bold text-white mb-2">Portfolio Stats</p>
                            <p className="text-slate-300">Return: <span className="text-green-400 font-mono">{(data.return * 100).toFixed(2)}%</span></p>
                            <p className="text-slate-300">Volatility: <span className="text-red-400 font-mono">{(data.volatility * 100).toFixed(2)}%</span></p>
                            <p className="text-slate-300">Sharpe: <span className="text-blue-400 font-mono">{data.sharpe.toFixed(2)}</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* All Simulations */}
                  <Scatter 
                    name="Portfolios" 
                    data={simResults} 
                    fill="#3b82f6" 
                    fillOpacity={0.6}
                    shape="circle"
                  >
                     {simResults.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.sharpe > 1 ? '#60a5fa' : '#1e40af'} />
                     ))}
                  </Scatter>
                  
                  {/* Highlight Optimal Portfolios */}
                  {optimalPortfolios && (
                    <>
                      <Scatter 
                        name="Max Sharpe" 
                        data={[optimalPortfolios.maxSharpe]} 
                        fill="#fbbf24" 
                        shape="star" 
                        r={10} // Bigger radius
                        zIndex={20}
                      />
                      <Scatter 
                        name="Min Volatility" 
                        data={[optimalPortfolios.minVol]} 
                        fill="#f87171" 
                        shape="diamond" 
                        r={10} 
                        zIndex={20}
                      />
                    </>
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[450px] flex flex-col items-center justify-center text-slate-500">
                 <TrendingUp className="w-16 h-16 opacity-20 mb-4" />
                 <p>Load data and run optimization to view the efficient frontier.</p>
              </div>
            )}
          </div>

          {/* Detailed Stats Grid */}
          {optimalPortfolios && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Max Sharpe Card */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-24 h-24 text-yellow-500" />
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Max Sharpe Ratio</h3>
                    <p className="text-xs text-slate-400">Best risk-adjusted return</p>
                  </div>
                  <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/20">
                    Target
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                  <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Return</p>
                    <p className="text-lg font-mono font-bold text-green-400">{(optimalPortfolios.maxSharpe.return * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Risk (Vol)</p>
                    <p className="text-lg font-mono font-bold text-red-400">{(optimalPortfolios.maxSharpe.volatility * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Sharpe</p>
                    <p className="text-lg font-mono font-bold text-blue-400">{optimalPortfolios.maxSharpe.sharpe.toFixed(2)}</p>
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">Allocation</h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tickers.map((t, i) => ({ name: t, value: optimalPortfolios.maxSharpe.weights[i] }))} layout="vertical" margin={{left: 10, right: 30}}>
                      <XAxis type="number" hide domain={[0, 1]} />
                      <YAxis type="category" dataKey="name" width={40} tick={{fill: '#94a3b8', fontSize: 10}} />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-xs px-2 py-1 rounded border border-slate-700">
                                {(payload[0].value * 100).toFixed(1)}%
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#fbbf24" radius={[0, 4, 4, 0]}>
                         {tickers.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Min Variance Card */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Shield className="w-24 h-24 text-red-500" />
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Global Min Variance</h3>
                    <p className="text-xs text-slate-400">Lowest possible volatility</p>
                  </div>
                  <div className="bg-red-500/10 text-red-500 px-3 py-1 rounded-full text-xs font-bold border border-red-500/20">
                    Defensive
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                  <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Return</p>
                    <p className="text-lg font-mono font-bold text-green-400">{(optimalPortfolios.minVol.return * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Risk (Vol)</p>
                    <p className="text-lg font-mono font-bold text-red-400">{(optimalPortfolios.minVol.volatility * 100).toFixed(2)}%</p>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded border border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase">Sharpe</p>
                    <p className="text-lg font-mono font-bold text-blue-400">{optimalPortfolios.minVol.sharpe.toFixed(2)}</p>
                  </div>
                </div>

                <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">Allocation</h4>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tickers.map((t, i) => ({ name: t, value: optimalPortfolios.minVol.weights[i] }))} layout="vertical" margin={{left: 10, right: 30}}>
                      <XAxis type="number" hide domain={[0, 1]} />
                      <YAxis type="category" dataKey="name" width={40} tick={{fill: '#94a3b8', fontSize: 10}} />
                      <Tooltip 
                        cursor={{fill: 'transparent'}}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-xs px-2 py-1 rounded border border-slate-700">
                                {(payload[0].value * 100).toFixed(1)}%
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" fill="#f87171" radius={[0, 4, 4, 0]}>
                        {tickers.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* Allocation Table */}
          {optimalPortfolios && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-700">
                  <h3 className="font-bold text-white">Allocation Comparison Table</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left text-slate-400">
                    <thead className="text-xs text-slate-300 uppercase bg-slate-900/50">
                      <tr>
                        <th className="px-6 py-3">Asset</th>
                        <th className="px-6 py-3">Max Sharpe Weight</th>
                        <th className="px-6 py-3">Min Vol Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickers.map((t, i) => {
                        const maxW = optimalPortfolios.maxSharpe.weights[i];
                        const minW = optimalPortfolios.minVol.weights[i];
                        return (
                          <tr key={t} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                               <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length]}}></span>
                               {t}
                            </td>
                            <td className={`px-6 py-4 font-mono ${maxW > 0.2 ? 'text-green-400' : ''}`}>{(maxW * 100).toFixed(2)}%</td>
                            <td className={`px-6 py-4 font-mono ${minW > 0.2 ? 'text-green-400' : ''}`}>{(minW * 100).toFixed(2)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
               </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default PortfolioOptimizer;

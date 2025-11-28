# MPTLab – Modern Portfolio Theory Optimizer  
React + Recharts + PHP (Yahoo Finance Proxy)

MPTLab is a web app that turns Modern Portfolio Theory into an interactive playground.

Upload historical price data, or fetch live market data, run Monte Carlo simulations on thousands of random portfolios, and visualize the efficient frontier with highlighted **max Sharpe** and **global minimum variance** portfolios.

🔗 Live demo: https://aliazary.com/apps/mptlab/index.html  


## Features

### Data sources

MPTLab supports three data modes:

1. **Sample mode**  
   Load a built-in demo universe:

   - SPY  
   - TLT  
   - GLD  
   - BTC  

   Useful to try the optimizer instantly without any setup.

2. **Upload mode (CSV)**  
   Upload your own historical prices in a simple wide format:

   ```text
   Date,SPY,TLT,GLD,BTC
   2023-01-01,380,100,170,16500
   2023-01-02,382,101,171,16600
   2023-01-03,381,102,172,16700
   ...


* First column: `Date` (YYYY-MM-DD)
* Remaining columns: tickers
* Values: prices (not returns; returns are computed inside the app)

A small sample file is included in `docs/sample_data.csv`.

3. **Fetch mode (live data)**
   Enter a list of tickers (comma separated), for example:

   ```text
   AAPL, MSFT, GOOG, TSLA
   ```

   The app:

   * Calls a lightweight PHP endpoint `api.php` on your server
   * The PHP script proxies Yahoo Finance’s `chart` API and returns JSON
   * MPTLab merges all tickers on a common date axis and generates a price history table

   If the API call fails (HTTP or data error), the app automatically falls back to **simulated historical prices** using a simple geometric-Brownian-motion-style generator, so the UI always remains usable.

### Portfolio analytics

* Converts prices → daily simple returns
* Computes annualized mean returns (assuming 252 trading days)
* Computes annualized covariance matrix of returns
* Runs Monte Carlo simulations over a configurable number of random portfolios
* Calculates for each portfolio:

  * Expected annual return
  * Annual volatility (standard deviation)
  * Sharpe ratio (using user-specified risk-free rate)

### Visualization and UI

* Efficient frontier scatter plot:

  * X-axis: portfolio volatility
  * Y-axis: expected return
* Highlights:

  * **Max Sharpe** portfolio (best risk-adjusted return)
  * **Global minimum variance** portfolio (lowest volatility)
* Interactive tooltips showing return, volatility, Sharpe
* Stats cards for both optimal portfolios
* Allocation bar charts (vertical, per asset)
* Allocation comparison table:

  * One row per asset
  * Side-by-side weights for max Sharpe vs min variance
* Dark, dashboard-style layout using Tailwind-like utility classes
* Clear loading states, error messages, and data source indicators

Version badge in the header currently shows `v1.1` to reflect live-data support.

## Theory overview

At a high level, MPTLab implements the classic Modern Portfolio Theory framework.

1. **Daily returns**

   For each asset:

   $$r_t = \frac{P_t - P_{t-1}}{P_{t-1}}$$

2. **Annualized mean return**

   Average daily return multiplied by the number of trading days (≈252):

   $$\mu_{\text{annual}} = \bar{r}_{\text{daily}} \times 252$$

3. **Annualized covariance matrix**

   Sample covariance of daily returns, also scaled by 252:

   $$\Sigma_{\text{annual}} = \text{Cov}(r_{\text{daily}}) \times 252$$

4. **Portfolio return and volatility**

   With weight vector $\mathbf{w}$, mean vector $\boldsymbol{\mu}$, and covariance matrix $\Sigma$:

   $$\mu_p = \mathbf{w}^\top \boldsymbol{\mu}$$

   $$\sigma_p^2 = \mathbf{w}^\top \Sigma \mathbf{w}, \quad \sigma_p = \sqrt{\sigma_p^2}$$

5. **Sharpe ratio**

   Given annual risk-free rate $r_f$:

   $$S = \frac{\mu_p - r_f}{\sigma_p}$$

MPTLab:

* Simulates random weight vectors
* Computes $(\sigma_p, \mu_p, S)$ for each portfolio
* Plots them as a cloud and highlights:

  * The max-Sharpe portfolio
  * The global minimum-variance portfolio

## Tech stack

* **Frontend**: React (TypeScript/JavaScript)
* **Charts**: Recharts
* **Icons**: `lucide-react`
* **Styling**: Tailwind-style utility classes (or similar utility CSS)
* **API layer**: PHP proxy to Yahoo Finance’s `chart` endpoint
* **Runtime**: Browser + PHP-enabled web server for `api.php`

## Project structure (suggested)

```text
mptlab-react/
  ├─ src/
  │   ├─ components/
  │   │   └─ PortfolioOptimizer.tsx
  │   ├─ main.tsx / index.tsx
  │   └─ ...
  ├─ public/
  ├─ api/
  │   └─ api.php
  ├─ docs/
  │   ├─ mptlab_tutorial.pdf
  │   └─ sample_data.csv
  ├─ package.json
  ├─ README.md
  └─ LICENSE
```

You can adapt the structure to your build system (Vite, CRA, Next, etc.).

## PHP API (Yahoo Finance proxy)

The `api.php` script is a thin proxy to Yahoo Finance to avoid CORS issues and keep requests server-side.

Example implementation:

```php
<?php
// api.php
// Usage: api.php?mode=json_data&symbol=AAPL&range=1y

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$mode   = isset($_GET['mode'])   ? $_GET['mode']   : '';
$symbol = isset($_GET['symbol']) ? $_GET['symbol'] : '';
$range  = isset($_GET['range'])  ? $_GET['range']  : '1y';

if ($mode !== 'json_data' || empty($symbol)) {
    echo json_encode(['error' => 'Invalid parameters']);
    exit;
}

$interval = '1d';
$baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/';
$url = $baseUrl . urlencode($symbol) .
       '?range=' . urlencode($range) .
       '&interval=' . urlencode($interval);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0');

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($result === false || $httpCode !== 200) {
    echo json_encode([
        'error'   => 'Upstream request failed',
        'code'    => $httpCode,
        'details' => $curlError
    ]);
    exit;
}

echo $result;
```

On the React side, each ticker is fetched via:

```ts
const url = `https://your-domain.com/apps/mptlab/api.php?mode=json_data&symbol=${encodeURIComponent(t)}&range=1y`;
```

The JSON response is parsed using the `chart.result[0].timestamp` and `chart.result[0].indicators.quote[0].close` arrays to reconstruct a `{ Date, Ticker1, Ticker2, ... }` table.

## Getting started

1. Clone the repo:

   ```bash
   git clone https://github.com/<your-username>/mptlab-react.git
   cd mptlab-react
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Make sure your `api.php` is deployed on a PHP-capable server and update the URL in `PortfolioOptimizer` if needed:

   ```ts
   const url = 'https://your-domain.com/apps/mptlab/api.php?...';
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open the local URL (e.g. `http://localhost:5173` for Vite) and:

   * Choose a data source: **Sample**, **Fetch**, or **Upload**
   * Adjust the risk-free rate and number of simulations
   * Click **Run Optimization** to generate and visualize the efficient frontier

## Tutorial and docs

The `docs/` folder contains:

* `mptlab_tutorial.pdf` – a detailed walkthrough of:

  * MPT math (returns, covariance, Sharpe, Monte Carlo)
  * React component structure
  * Recharts visualizations and UI layout
* `sample_data.csv` – small sample dataset for quick testing

## Possible extensions

Ideas for extending MPTLab:

* Support for portfolio constraints:

  * Max/min weights per asset
  * Long-only vs long/short
  * Group/sector constraints
* Plot the **Capital Market Line (CML)** for a given risk-free rate
* Allow users to overlay their current portfolio on the efficient frontier
* Export optimal allocations as CSV/JSON
* Generate a PDF or HTML report summarizing optimal portfolios and key metrics
* Move heavy computations / optimization to a Python or Node backend if needed

## Custom portfolio and risk tools

MPTLab is an example of how quantitative finance concepts can be turned into production-like tools.

If your fund, desk, or team would like a **custom portfolio / risk management app or automation**, built around your own:

* Asset universe and instruments
* Data feeds and APIs
* Constraints and risk limits
* Reporting format and workflows

I build:

* Web dashboards (React/TypeScript or Python-based frontends)
* Python backtesting and analytics engines
* End-to-end data and reporting automations

Contact:

* Website: [https://aliazary.com](https://aliazary.com)
* LinkedIn: [https://www.linkedin.com/in/ali-azary/](https://www.linkedin.com/in/ali-azary/)


::contentReference[oaicite:0]{index=0}
```

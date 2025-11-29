<?php
// Simple PHP proxy to Yahoo Finance "chart" endpoint
// URL example: /api.php?mode=json_data&symbol=AAPL&range=1y

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

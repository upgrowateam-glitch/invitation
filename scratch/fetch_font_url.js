const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchFontUrl() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0'
  ];

  userAgents.forEach((ua, idx) => {
    https.get('https://fonts.googleapis.com/css2?family=Clicker+Script:wght@400', { headers: { 'User-Agent': ua } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`--- UA ${idx} ---`);
        console.log(body);
        const matches = [...body.matchAll(/url\((https:\/\/[^)]+)\)/g)];
        matches.forEach(m => console.log('Found font URL:', m[1]));
      });
    });
  });
}

fetchFontUrl();

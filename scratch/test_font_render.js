const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '../server/node_modules/sharp'));

async function testFontRender() {
  const fontPath = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
  if (!fs.existsSync(fontPath)) {
    throw new Error(`CRITICAL: Font file not found at ${fontPath}`);
  }

  const fontBuffer = fs.readFileSync(fontPath);
  const base64Font = fontBuffer.toString('base64');
  console.log(`Loaded ClickerScript-Regular.ttf (${fontBuffer.length} bytes, base64 len: ${base64Font.length})`);

  const width = 1080;
  const height = 1920;
  const fontSizePx = 90;
  const fontColour = '#000000';
  const textName = 'Asritha Test';

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style type="text/css">
          @font-face {
            font-family: 'Clicker Script';
            font-style: normal;
            font-weight: 400;
            src: url('data:font/ttf;charset=utf-8;base64,${base64Font}') format('truetype');
          }
          .receiver-name {
            font-family: 'Clicker Script', cursive;
            font-size: ${fontSizePx}px;
            font-weight: 400;
            fill: ${fontColour};
            text-anchor: middle;
            dominant-baseline: middle;
          }
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#ffffff" />
      <text x="${width / 2}" y="${height * 0.565}" class="receiver-name">${textName}</text>
    </svg>
  `;

  const renderedPng = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  const outputPath = path.join(__dirname, 'font_test_render.png');
  fs.writeFileSync(outputPath, renderedPng);
  console.log(`Rendered test font image to: ${outputPath} (${renderedPng.length} bytes)`);
}

testFontRender().catch(console.error);

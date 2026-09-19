const path = require('path');
const fs = require('fs');
const { createCanvas, GlobalFonts } = require(path.join(__dirname, '../server/node_modules/@napi-rs/canvas'));

async function testCanvasFont() {
  const fontPath = path.join(__dirname, '../server/assets/fonts/ClickerScript-Regular.ttf');
  if (!fs.existsSync(fontPath)) {
    throw new Error(`Font missing at ${fontPath}`);
  }

  // Register TTF font explicitly into Skia GlobalFonts
  const registered = GlobalFonts.registerFromPath(fontPath, 'Clicker Script');
  console.log('Registered Clicker Script font:', registered);

  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');

  // Fill background white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1080, 1920);

  // Set font
  ctx.font = '400 110px "Clicker Script"';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Draw text
  ctx.fillText('Asritha Test', 540, 1920 * 0.565);

  const buffer = canvas.toBuffer('image/png');
  const outPath = path.join(__dirname, 'canvas_clicker_script_test.png');
  fs.writeFileSync(outPath, buffer);
  console.log('Saved canvas test to:', outPath);
}

testCanvasFont().catch(console.error);

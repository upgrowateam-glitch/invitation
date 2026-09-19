const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '../server/node_modules/sharp'));

async function verifyAssets() {
  const token = 'a5f7eccf9b749f2bf5f27bfeca4fc4c990b92848da93a5baea4d7907d8ed2270';
  const mainPath = path.join(__dirname, `../uploads/generated/invite-${token}.png`);
  const ogPath = path.join(__dirname, `../uploads/social/invite-${token}.jpg`);

  console.log('=== VERIFYING REGENERATED ASSETS FOR SINGLE RECIPIENT ===\n');

  console.log(`1. Main Image (${mainPath}):`);
  if (fs.existsSync(mainPath)) {
    const stat = fs.statSync(mainPath);
    const meta = await sharp(mainPath).metadata();
    console.log(`   - Exists: YES`);
    console.log(`   - File Size: ${Math.round(stat.size / 1024)} KB (${stat.size} bytes)`);
    console.log(`   - Format: ${meta.format.toUpperCase()}`);
    console.log(`   - Dimensions: ${meta.width}x${meta.height}`);
    console.log(`   - Is Full-HD (>= 1080x1920): ${meta.width >= 1080 && meta.height >= 1920 ? 'YES' : 'NO'}`);
  } else {
    console.log(`   - Exists: NO`);
  }

  console.log(`\n2. Open Graph Social Preview (${ogPath}):`);
  if (fs.existsSync(ogPath)) {
    const stat = fs.statSync(ogPath);
    const meta = await sharp(ogPath).metadata();
    console.log(`   - Exists: YES`);
    console.log(`   - File Size: ${Math.round(stat.size / 1024)} KB (${stat.size} bytes)`);
    console.log(`   - Format: ${meta.format.toUpperCase()}`);
    console.log(`   - Dimensions: ${meta.width}x${meta.height}`);
    console.log(`   - Is Exact 1200x630: ${meta.width === 1200 && meta.height === 630 ? 'YES' : 'NO'}`);
  } else {
    console.log(`   - Exists: NO`);
  }
}

verifyAssets();

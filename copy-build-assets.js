const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // 1. Ensure PNG exists for all template PDFs in uploads/templates
  const templatesDir = path.join(__dirname, 'uploads/templates');
  if (fs.existsSync(templatesDir)) {
    const bniPng = path.join(templatesDir, 'bni-template.png');
    const files = fs.readdirSync(templatesDir);
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        const pngFile = file.replace('.pdf', '.png');
        const pngPath = path.join(templatesDir, pngFile);
        if (!fs.existsSync(pngPath) && fs.existsSync(bniPng)) {
          fs.copyFileSync(bniPng, pngPath);
          console.log(`Copied ${bniPng} -> ${pngPath}`);
        }
      }
    }
  }

  // 2. Copy uploads to client/dist/uploads
  const uploadsSrc = path.join(__dirname, 'uploads');
  const uploadsDest = path.join(__dirname, 'client/dist/uploads');
  if (fs.existsSync(uploadsSrc)) {
    copyDir(uploadsSrc, uploadsDest);
    console.log('Successfully copied uploads/ to client/dist/uploads/');
  }
} catch (err) {
  console.error('Error copying build assets:', err);
}

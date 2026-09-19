const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const fs = require('fs');
const os = require('os');

const prisma = new PrismaClient();

async function fullDiagnosis() {
  try {
    const recipients = await prisma.recipient.findMany({
      include: {
        invitation: true,
        design: true
      },
      orderBy: { id: 'asc' }
    });

    console.log(`=== FULL RECIPIENT DIAGNOSIS (${recipients.length} records) ===\n`);

    const candidateDirs = [
      path.join(__dirname, '../uploads'),
      path.join(process.cwd(), 'uploads'),
      path.join(process.cwd(), 'server/uploads'),
      path.join(os.tmpdir(), 'uploads')
    ];

    const sharp = require(path.join(__dirname, '../server/node_modules/sharp'));

    let totalRecipients = recipients.length;
    let missingFiles = 0;
    let zeroByteFiles = 0;
    let pdfFiles = 0;
    let pngJpgFiles = 0;
    let missingOgPreviews = 0;
    let templateFallbacksNeeded = 0;

    const summaryList = [];

    for (const r of recipients) {
      let status = 'OK';
      let fileSize = 0;
      let dimensions = null;
      let fileExists = false;
      let resolvedPath = null;

      if (!r.generatedPdfPath) {
        status = 'MISSING_PATH';
        missingFiles++;
      } else if (r.generatedPdfPath.startsWith('data:')) {
        status = 'INLINE_BASE64';
        fileExists = true;
      } else {
        const relPath = r.generatedPdfPath.replace(/^\//, '');
        for (const baseDir of candidateDirs) {
          const absPath = path.join(baseDir, '..', relPath);
          if (fs.existsSync(absPath)) {
            fileExists = true;
            resolvedPath = absPath;
            const stat = fs.statSync(absPath);
            fileSize = stat.size;
            break;
          }
        }

        if (!fileExists) {
          status = 'FILE_NOT_FOUND';
          missingFiles++;
        } else if (fileSize < 100) {
          status = 'CORRUPT_OR_EMPTY';
          zeroByteFiles++;
        } else if (r.generatedPdfPath.endsWith('.pdf')) {
          pdfFiles++;
          status = 'PDF_FILE';
        } else {
          pngJpgFiles++;
          try {
            const meta = await sharp(resolvedPath).metadata();
            dimensions = `${meta.width}x${meta.height}`;
          } catch (e) {
            dimensions = 'INVALID_IMAGE';
          }
        }
      }

      // Check OG Preview file
      const ogFileName = `invite-${r.token}.jpg`;
      const ogPath = path.join(__dirname, '../uploads/social', ogFileName);
      const ogExists = fs.existsSync(ogPath);
      if (!ogExists) missingOgPreviews++;

      summaryList.push({
        id: r.id,
        name: r.name,
        token: `${r.token.substring(0, 8)}...`,
        status,
        fileSize: `${Math.round(fileSize / 1024)} KB`,
        dimensions,
        templateId: r.templateId,
        path: r.generatedPdfPath,
        ogExists
      });
    }

    console.table(summaryList);
    console.log(`\nSummary Statistics:`);
    console.log(`- Total Recipients: ${totalRecipients}`);
    console.log(`- Missing/Broken Files: ${missingFiles}`);
    console.log(`- Zero-byte/Corrupt Files: ${zeroByteFiles}`);
    console.log(`- PDF Files (Old Format): ${pdfFiles}`);
    console.log(`- Image Files (PNG/JPG): ${pngJpgFiles}`);
    console.log(`- Missing WhatsApp OG Previews: ${missingOgPreviews}`);

  } catch (err) {
    console.error('Error during full diagnosis:', err);
  } finally {
    await prisma.$disconnect();
  }
}

fullDiagnosis();

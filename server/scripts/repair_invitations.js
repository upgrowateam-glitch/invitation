const path = require('path');
const fs = require('fs');
const os = require('os');
const { PrismaClient } = require(path.join(__dirname, '../node_modules/@prisma/client'));
const { generateInvitationAssets } = require(path.join(__dirname, '../src/utils/imageGenerator'));
const { backupDatabase } = require('./backup_db');

const prisma = new PrismaClient();

const getUploadCandidates = () => {
  const envCustom = process.env.PERSISTENT_UPLOADS_DIR;
  const candidates = [
    ...(envCustom ? [envCustom] : []),
    path.join(__dirname, '../../uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'server/uploads'),
    path.join(__dirname, '../../client/dist/uploads'),
    path.join(os.tmpdir(), 'uploads')
  ];
  return candidates;
};

// Mask token for privacy in reports
const maskToken = (token) => {
  if (!token) return 'null';
  if (token.length <= 10) return `${token.substring(0, 3)}***`;
  return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
};

// Check if an image path exists on disk and is a valid Full-HD image
const checkAssetValidity = async (relPath) => {
  if (!relPath) return { exists: false, isFullHD: false, reason: 'Empty path' };
  if (relPath.startsWith('data:')) return { exists: true, isFullHD: false, reason: 'Inline base64' };
  if (relPath.endsWith('.pdf')) return { exists: true, isFullHD: false, reason: 'Legacy PDF format' };

  const candidateDirs = getUploadCandidates();
  let absolutePath = null;
  const cleanRel = relPath.replace(/^\//, '');

  for (const baseDir of candidateDirs) {
    const p = path.join(baseDir, '..', cleanRel);
    if (fs.existsSync(p)) {
      absolutePath = p;
      break;
    }
  }

  if (!absolutePath) {
    return { exists: false, isFullHD: false, reason: 'File does not exist on disk' };
  }

  const stat = fs.statSync(absolutePath);
  if (stat.size < 1000) {
    return { exists: true, isFullHD: false, reason: 'Corrupt or 0-byte file' };
  }

  try {
    const sharp = require(path.join(__dirname, '../node_modules/sharp'));
    const meta = await sharp(absolutePath).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;

    // Minimum Full-HD requirement: 1080x1920 portrait (or equivalent resolution)
    const isPortrait = height >= width;
    const isFullHD = isPortrait ? (width >= 1080 && height >= 1920) : (width >= 1920 && height >= 1080);

    if (!isFullHD) {
      return { exists: true, isFullHD: false, dimensions: `${width}x${height}`, reason: `Low resolution (${width}x${height})` };
    }

    return { exists: true, isFullHD: true, dimensions: `${width}x${height}`, reason: 'Valid Full-HD asset' };
  } catch (err) {
    return { exists: true, isFullHD: false, reason: `Image read error: ${err.message}` };
  }
};

async function repairInvitations() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  let singleToken = null;
  const tokenIdx = args.indexOf('--single-token');
  if (tokenIdx !== -1 && args[tokenIdx + 1]) {
    singleToken = args[tokenIdx + 1];
  }

  let limit = null;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  console.log(`\n=============================================================`);
  console.log(` INVITATION REPAIR BATCH SCRIPT`);
  console.log(` Mode: ${isDryRun ? 'DRY-RUN (No changes will be saved)' : 'LIVE EXECUTION'}`);
  if (singleToken) console.log(` Target: Single Token (${maskToken(singleToken)})`);
  if (limit) console.log(` Limit: ${limit} recipients`);
  if (isForce) console.log(` Force: YES (Regenerating even if valid)`);
  console.log(`=============================================================\n`);

  // Step 1: Query recipients
  const whereClause = singleToken ? { token: singleToken } : {};
  const queryOpts = {
    where: whereClause,
    include: { design: true, invitation: true },
    orderBy: { id: 'asc' }
  };
  if (limit) queryOpts.take = limit;

  const recipients = await prisma.recipient.findMany(queryOpts);

  if (recipients.length === 0) {
    console.log('No matching recipients found in database.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${recipients.length} candidate recipient record(s).\n`);

  // Step 2: Perform diagnostic scan
  const targets = [];

  for (const r of recipients) {
    const validity = await checkAssetValidity(r.generatedPdfPath);
    
    // Check if WhatsApp OG image exists in social folder
    const ogFileName = `invite-${r.token}.jpg`;
    const ogCandidates = getUploadCandidates().map(dir => path.join(dir, 'social', ogFileName));
    const ogExists = ogCandidates.some(p => fs.existsSync(p));

    const needsRepair = isForce || !validity.isFullHD || !ogExists;

    targets.push({
      recipient: r,
      validity,
      ogExists,
      needsRepair
    });
  }

  const affectedCount = targets.filter(t => t.needsRepair).length;
  const validCount = targets.filter(t => !t.needsRepair).length;

  console.log(`Scan Summary:`);
  console.log(`- Total Checked: ${targets.length}`);
  console.log(`- Valid Full-HD Assets: ${validCount}`);
  console.log(`- Affected / Needing Repair: ${affectedCount}\n`);

  if (isDryRun) {
    console.log(`--- DRY-RUN REPORT (No database records modified) ---`);
    const reportTable = targets.map(t => ({
      id: t.recipient.id,
      name: t.recipient.name,
      tokenMasked: maskToken(t.recipient.token),
      oldPath: t.recipient.generatedPdfPath || 'EMPTY',
      status: t.validity.reason,
      dimensions: t.validity.dimensions || 'N/A',
      needsRepair: t.needsRepair ? 'YES' : 'NO'
    }));
    console.table(reportTable);
    console.log(`\nDry run complete. Run without --dry-run to apply changes.`);
    await prisma.$disconnect();
    return;
  }

  if (affectedCount === 0 && !isForce) {
    console.log(`All recipients already have valid Full-HD images and social previews. No repair needed.`);
    await prisma.$disconnect();
    return;
  }

  // Step 3: Take Database Backup before modifying data in live execution mode
  console.log(`[SAFETY] Taking production database snapshot backup...`);
  const backupFile = await backupDatabase();

  // Step 4: Execute Batch Repair
  console.log(`\n[REPAIR] Starting batch regeneration for ${affectedCount} recipient(s)...`);

  const results = [];
  const rollbackManifest = {
    timestamp: new Date().toISOString(),
    backupFile,
    records: []
  };

  const concurrency = 5;
  const toProcess = targets.filter(t => t.needsRepair);

  for (let i = 0; i < toProcess.length; i += concurrency) {
    const chunk = toProcess.slice(i, i + concurrency);
    
    await Promise.all(chunk.map(async (item) => {
      const r = item.recipient;
      try {
        const designConfig = r.design ? r.design.designConfiguration : null;

        const assetResult = await generateInvitationAssets({
          recipientName: r.name,
          templateId: r.templateId,
          designConfiguration: designConfig,
          token: r.token,
          recipientId: r.id
        });

        // UPDATE ONLY ASSET PATH FIELDS IN MYSQL RECIPIENT RECORD
        // Strict preservation: ID, token, responseStatus, dates, names, notes, guests remain strictly UNCHANGED
        const updatedRecipient = await prisma.recipient.update({
          where: { id: r.id },
          data: {
            generatedPdfPath: assetResult.generatedPdfPath,
            // also assign templateId if resolved from fallback
            templateId: assetResult.templateUsedId
          }
        });

        const recResult = {
          id: r.id,
          name: r.name,
          tokenMasked: maskToken(r.token),
          oldPath: r.generatedPdfPath,
          newPath: assetResult.generatedPdfPath,
          ogPath: assetResult.ogImagePath,
          dimensions: `${assetResult.canvasWidth}x${assetResult.canvasHeight}`,
          templateUsed: assetResult.templateName,
          isFallback: assetResult.isFallback,
          status: 'REPAIRED'
        };

        results.push(recResult);
        rollbackManifest.records.push({
          id: r.id,
          token: r.token,
          oldPath: r.generatedPdfPath,
          newPath: assetResult.generatedPdfPath,
          oldTemplateId: r.templateId,
          newTemplateId: assetResult.templateUsedId
        });

      } catch (err) {
        console.error(`[ERROR] Failed to repair recipient ID ${r.id} (${r.name}):`, err.message);
        results.push({
          id: r.id,
          name: r.name,
          tokenMasked: maskToken(r.token),
          oldPath: r.generatedPdfPath,
          status: 'FAILED',
          error: err.message
        });
      }
    }));
  }

  // Save Rollback Manifest
  const manifestDir = path.join(__dirname, '../../scratch');
  if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `rollback_manifest_${Date.now()}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(rollbackManifest, null, 2), 'utf8');

  console.log(`\n=============================================================`);
  console.log(` REPAIR EXECUTION COMPLETE`);
  console.log(` Total Processed: ${results.length}`);
  console.log(` Successfully Repaired: ${results.filter(r => r.status === 'REPAIRED').length}`);
  console.log(` Failures: ${results.filter(r => r.status === 'FAILED').length}`);
  console.log(` Rollback Manifest Saved: ${manifestPath}`);
  console.log(`=============================================================\n`);

  console.table(results);
  await prisma.$disconnect();
}

if (require.main === module) {
  repairInvitations().catch(err => {
    console.error('Fatal batch script error:', err);
    process.exit(1);
  });
}

module.exports = { repairInvitations };

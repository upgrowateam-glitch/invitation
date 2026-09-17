const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@invitation.com';
  
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('Admin user already exists!');
  } else {
    // Hash the password 'admin123'
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create Super Admin
    const admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
      },
    });

    console.log(`Successfully created admin user: ${admin.email} / admin123`);
  }

  // Add BNI Template
  const existingTemplate = await prisma.template.findFirst({
    where: { name: 'BNI Invitation Card' }
  });

  if (!existingTemplate) {
    const bniTemplate = await prisma.template.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: 'BNI Invitation Card',
        description: 'Standard BNI meeting invitation',
        category: 'Business Meeting',
        sourceType: 'SYSTEM',
        fileType: 'PDF',
        isSystemTemplate: true,
        originalFilePath: '/uploads/templates/bni-template.pdf',
        thumbnailPath: '/uploads/templates/bni-template.pdf',
        defaultConfig: {
          create: {
            pageNumber: 1,
            xPosition: 0.1,
            yPosition: 0.45,
            textBoxWidth: 0.8,
            fontFamily: 'Helvetica',
            fontSize: 32,
            fontWeight: 'bold',
            fontColour: '#DC2626',
            textAlignment: 'center'
          }
        }
      }
    });
    console.log(`Successfully created template: ${bniTemplate.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

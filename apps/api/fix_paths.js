const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe("UPDATE Recording SET audioPath = SUBSTRING_INDEX(audioPath, '\\\\', -1);");
  console.log('Paths updated in DB');
}
main().catch(console.error);

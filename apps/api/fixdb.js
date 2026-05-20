const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const records = await prisma.recording.findMany(); 
  for (const r of records) { 
    const newPath = r.audioPath.includes('uploads/recordings/') 
      ? r.audioPath 
      : 'uploads/recordings/' + r.audioPath.split(/[\\/]/).pop(); 
    await prisma.recording.update({ 
      where: { id: r.id }, 
      data: { 
        audioPath: newPath, 
        status: 'Pending', 
        sentiment: null, 
        score: null, 
        result: null, 
        openingStatus: null, 
        tone: null, 
        energyLevel: null, 
        activeListening: null 
      } 
    }); 
  } 
  console.log('Database fixed'); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());

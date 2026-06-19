import "dotenv/config";
import { PrismaClient, Weekday } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});

/**
 * Popula o banco com alguns registros fictícios em cada tabela, só para
 * o painel não aparecer vazio na primeira vez que o vendedor abrir a tela.
 *
 * Rodar com: npx prisma db seed
 */
async function main() {
  console.log('🌱 Iniciando seed...');

  // ── Especialidades ─────────────────────────────────────────────────────────
  const specialtyData = [
    { name: 'Clínica Geral' },
    { name: 'Cardiologia' },
    { name: 'Pediatria' },
    { name: 'Dermatologia' },
    { name: 'Ortopedia' },
    { name: 'Ginecologia' },
    { name: 'Neurologia' },
  ];

  const specialties = await Promise.all(
    specialtyData.map((s) =>
      prisma.specialty.upsert({ where: { name: s.name }, update: {}, create: s })
    )
  );
  console.log(`✅ ${specialties.length} especialidades criadas`);

  const [clinicaGeral, cardiologia, pediatria] = specialties;

  // ── Médicos ────────────────────────────────────────────────────────────────
  const drAna = await prisma.doctor.upsert({
    where: { crm: 'CRM-MG-12345' }, update: {},
    create: { name: 'Dra. Ana Paula Ferreira', crm: 'CRM-MG-12345', specialtyId: clinicaGeral.id },
  });
  const drCarlos = await prisma.doctor.upsert({
    where: { crm: 'CRM-MG-67890' }, update: {},
    create: { name: 'Dr. Carlos Eduardo Lima', crm: 'CRM-MG-67890', specialtyId: cardiologia.id },
  });
  const drMariana = await prisma.doctor.upsert({
    where: { crm: 'CRM-MG-11223' }, update: {},
    create: { name: 'Dra. Mariana Costa', crm: 'CRM-MG-11223', specialtyId: pediatria.id },
  });
  console.log('✅ 3 médicos criados');

  // ── Grades semanais ────────────────────────────────────────────────────────
  await prisma.doctorSchedule.createMany({
    skipDuplicates: true,
    data: [
      // Dra. Ana — seg/qua/sex: manhã e tarde
      { doctorId: drAna.id, weekday: Weekday.MONDAY,    startTime: '08:00', endTime: '12:00' },
      { doctorId: drAna.id, weekday: Weekday.MONDAY,    startTime: '14:00', endTime: '18:00' },
      { doctorId: drAna.id, weekday: Weekday.WEDNESDAY, startTime: '08:00', endTime: '12:00' },
      { doctorId: drAna.id, weekday: Weekday.WEDNESDAY, startTime: '14:00', endTime: '18:00' },
      { doctorId: drAna.id, weekday: Weekday.FRIDAY,    startTime: '08:00', endTime: '12:00' },
      // Dr. Carlos — ter/qui/sab
      { doctorId: drCarlos.id, weekday: Weekday.TUESDAY,   startTime: '08:00', endTime: '12:00' },
      { doctorId: drCarlos.id, weekday: Weekday.THURSDAY,  startTime: '08:00', endTime: '12:00' },
      { doctorId: drCarlos.id, weekday: Weekday.THURSDAY,  startTime: '14:00', endTime: '17:00' },
      { doctorId: drCarlos.id, weekday: Weekday.SATURDAY,  startTime: '08:00', endTime: '11:00' },
      // Dra. Mariana — seg-sex: tarde
      { doctorId: drMariana.id, weekday: Weekday.MONDAY,    startTime: '14:00', endTime: '18:00' },
      { doctorId: drMariana.id, weekday: Weekday.TUESDAY,   startTime: '14:00', endTime: '18:00' },
      { doctorId: drMariana.id, weekday: Weekday.WEDNESDAY, startTime: '14:00', endTime: '18:00' },
      { doctorId: drMariana.id, weekday: Weekday.THURSDAY,  startTime: '14:00', endTime: '18:00' },
      { doctorId: drMariana.id, weekday: Weekday.FRIDAY,    startTime: '14:00', endTime: '18:00' },
    ],
  });
  console.log('✅ Grades semanais criadas');

  // ── Agendamentos de exemplo ────────────────────────────────────────────────
  await prisma.appointment.upsert({
    where: { code: 'AGD-1001' }, update: {},
    create: {
      code: 'AGD-1001', patientName: 'João da Silva',
      email: 'joao@email.com', phone: '(35) 99999-1111',
      specialtyId: clinicaGeral.id, doctorId: drAna.id,
      appointmentDate: '2026-07-07', startTime: '09:00', endTime: '09:30',
      reason: 'Consulta de rotina',
    },
  });
  await prisma.appointment.upsert({
    where: { code: 'AGD-1002' }, update: {},
    create: {
      code: 'AGD-1002', patientName: 'Maria Oliveira',
      email: 'maria@email.com', phone: '(35) 99999-2222',
      specialtyId: cardiologia.id, doctorId: drCarlos.id,
      appointmentDate: '2026-07-08', startTime: '10:00', endTime: '10:30',
      reason: 'Dor no peito ocasional',
    },
  });
  console.log('✅ 2 agendamentos de exemplo criados');

  // ── Oportunidades ──────────────────────────────────────────────────────────
  await prisma.opportunity.upsert({
    where: { code: 'CRM-1001' }, update: {},
    create: {
      code: 'CRM-1001', contactName: 'Pedro Costa', company: 'Tech Solutions',
      email: 'pedro@techsolutions.com', phone: '(11) 98888-0001',
      need: 'PABX em nuvem para 50 ramais', hasPabx: false, highVolume: true,
      digitalChannels: 'WhatsApp e e-mail',
    },
  });
  await prisma.opportunity.upsert({
    where: { code: 'CRM-1002' }, update: {},
    create: {
      code: 'CRM-1002', contactName: 'Fernanda Lima', company: 'Varejo Rápido',
      email: 'fernanda@varejor.com', phone: '(11) 98888-0002',
      need: 'Atendimento omnichannel com integração CRM', hasPabx: true, highVolume: true,
      digitalChannels: 'WhatsApp, telefone e chat',
    },
  });

  // ── Tickets ────────────────────────────────────────────────────────────────
  await prisma.ticket.upsert({
    where: { code: 'SUP-1001' }, update: {},
    create: {
      code: 'SUP-1001', name: 'Ricardo Almeida', company: 'Alfa Energia',
      email: 'ricardo@alfa.com', requesterType: 'CLIENTE',
      product: 'PABX em nuvem', problem: 'Ramais sem completar chamadas externas', priority: 'ALTA',
    },
  });
  await prisma.ticket.upsert({
    where: { code: 'SUP-1002' }, update: {},
    create: {
      code: 'SUP-1002', name: 'Bruna Souza', company: 'Beta Sistemas',
      email: 'bruna@beta.com', requesterType: 'CONCESSIONARIA',
      product: 'Softphone', problem: 'Erro ao fazer login no aplicativo', priority: 'MEDIA',
    },
  });

  console.log('✅ Dados de exemplo criados');
  console.log('🎉 Seed concluído!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

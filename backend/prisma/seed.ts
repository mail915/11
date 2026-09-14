import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

const DEMO_USERS = [
  { name: "Анна Иванова", email: "anna@demo.local" },
  { name: "Борис Петров", email: "boris@demo.local" },
  { name: "Виктория Смирнова", email: "victoria@demo.local" },
  { name: "Дмитрий Кузнецов", email: "dmitry@demo.local" },
  { name: "Елена Соколова", email: "elena@demo.local" },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = [];
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
    users.push(user);
  }
  const [anna, boris, victoria, dmitry, elena] = users;

  const team = await prisma.team.create({
    data: {
      name: "МБН — Департамент интегрированного планирования",
      members: {
        create: [
          { userId: anna.id, role: "OWNER" },
          { userId: boris.id, role: "MEMBER" },
          { userId: victoria.id, role: "MEMBER" },
          { userId: dmitry.id, role: "MEMBER" },
          { userId: elena.id, role: "MEMBER" },
        ],
      },
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "S&OP: внедрение IBP",
      description: "Методология планирования продаж и операций, внедрение IBP-системы",
      teamId: team.id,
      members: {
        create: [
          { userId: anna.id, role: "OWNER" },
          { userId: boris.id, role: "ADMIN" },
          { userId: victoria.id, role: "MEMBER" },
          { userId: dmitry.id, role: "MEMBER" },
        ],
      },
    },
  });

  const today = new Date();
  const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

  await prisma.task.createMany({
    data: [
      {
        title: "Собрать требования к процессу Demand Review",
        description: "Интервью с продажами и производством, сбор текущих pain points",
        status: "DONE",
        priority: "HIGH",
        startDate: daysFromNow(-14),
        dueDate: daysFromNow(-5),
        projectId: project.id,
        assigneeId: boris.id,
        createdById: anna.id,
      },
      {
        title: "Спроектировать методологию S&OP-цикла",
        description: "Такт-план: Demand Review -> Supply Review -> Reconciliation -> Exec S&OP",
        status: "IN_PROGRESS",
        priority: "HIGH",
        startDate: daysFromNow(-7),
        dueDate: daysFromNow(7),
        projectId: project.id,
        assigneeId: anna.id,
        createdById: anna.id,
      },
      {
        title: "Настроить интеграцию IBP с 1С/производственными данными",
        description: "Мэппинг справочников, автоматическая выгрузка факта",
        status: "TODO",
        priority: "MEDIUM",
        startDate: daysFromNow(3),
        dueDate: daysFromNow(21),
        projectId: project.id,
        assigneeId: dmitry.id,
        createdById: boris.id,
      },
      {
        title: "Пилот S&OP на мясопереработке (свинина)",
        description: "Тестовый цикл на одном бизнес-юните перед масштабированием",
        status: "TODO",
        priority: "MEDIUM",
        startDate: daysFromNow(10),
        dueDate: daysFromNow(30),
        projectId: project.id,
        assigneeId: victoria.id,
        createdById: anna.id,
      },
      {
        title: "Обучение участников процесса S&OP",
        description: "Тренинг для руководителей направлений",
        status: "TODO",
        priority: "LOW",
        startDate: daysFromNow(20),
        dueDate: daysFromNow(35),
        projectId: project.id,
        createdById: anna.id,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo users (password for all: %s):", DEMO_PASSWORD);
  for (const u of DEMO_USERS) console.log(`  - ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

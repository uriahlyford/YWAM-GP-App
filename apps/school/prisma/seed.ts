import "dotenv/config";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { addDays, isWeekend, toDbDate, today, type DateOnly } from "@/lib/date";
import {
  ADDRESSES,
  ASSESSMENT_TITLES,
  ENGLISH_NAMES,
  FAMILY_NAMES,
  GIVEN_NAMES_FEMALE,
  GIVEN_NAMES_MALE,
  GRADE_LEVELS,
  SUBJECTS,
} from "./seed-data";
import {
  AttendanceStatus,
  ClassTeacherRole,
  Gender,
  GuardianRelationship,
  Locale,
  Role,
} from "@/generated/prisma/enums";

/**
 * Development data.
 *
 * Deterministic: the same seed produces the same school every time, so a bug
 * found on Tuesday is still reproducible on Thursday. `Math.random` would make
 * "it only happens for one student" impossible to chase.
 */

const DEMO_PASSWORD = "sala-demo-2026";
const STUDENT_COUNT = 124;
const ATTENDANCE_DAYS = 40;

// mulberry32 — small, fast, and reproducible from a fixed seed.
function makeRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260814);
const pick = <T,>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];
const chance = (p: number) => random() < p;
const between = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

/** Cambodian mobile numbers: 0XX XXX XXX, stored normalised to +855. */
function phone(): string {
  const prefix = pick(["10", "11", "12", "15", "16", "17", "70", "77", "81", "92", "96", "97"]);
  return `+855${prefix}${String(between(100000, 999999))}`;
}

async function clear() {
  // Child rows first. `deleteMany` in dependency order rather than TRUNCATE, so
  // this works against a database the developer may share with other data.
  await prisma.delivery.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.studentCredential.deleteMany();
  await prisma.presenceEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.gradeRecord.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.attendanceSession.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.classTeacher.deleteMany();
  await prisma.class.deleteMany();
  await prisma.studentGuardian.deleteMany();
  await prisma.student.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.term.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.gradeLevel.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
}

async function main() {
  console.log("Clearing…");
  await clear();

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  console.log("School…");
  const school = await prisma.school.create({
    data: {
      code: "PP01",
      name: "Sala Preah Vihear Primary School",
      nameKm: "សាលាបឋមសិក្សាព្រះវិហារ",
      address: "Street 271, Sangkat Tuol Sangke, Khan Russey Keo, Phnom Penh",
      addressKm: "ផ្លូវ ២៧១ សង្កាត់ទួលសង្កែ ខណ្ឌឫស្សីកែវ រាជធានីភ្នំពេញ",
      phone: "+85523900100",
      email: "office@sala.example.kh",
      timezone: "Asia/Phnom_Penh",
    },
  });

  console.log("Grade levels and subjects…");
  const gradeLevels = await Promise.all(
    GRADE_LEVELS.map(([name, nameKm], i) =>
      prisma.gradeLevel.create({
        data: { schoolId: school.id, name, nameKm, ordinal: i },
      }),
    ),
  );

  const subjects = await Promise.all(
    SUBJECTS.map(([code, name, nameKm], i) =>
      prisma.subject.create({
        data: { schoolId: school.id, code, name, nameKm, ordinal: i },
      }),
    ),
  );

  console.log("Academic years and terms…");
  // The Cambodian school year runs roughly November to August.
  const previousYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2025–2026",
      nameKm: "ឆ្នាំសិក្សា ២០២៥–២០២៦",
      startDate: toDbDate("2025-11-03"),
      endDate: toDbDate("2026-08-07"),
      isCurrent: false,
    },
  });

  const currentYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2026–2027",
      nameKm: "ឆ្នាំសិក្សា ២០២៦–២០២៧",
      startDate: toDbDate("2026-11-02"),
      endDate: toDbDate("2027-08-06"),
      isCurrent: true,
    },
  });

  // The demo runs "now" (August 2026), which falls inside the previous year's
  // calendar — so that is the year carrying classes, attendance and grades.
  for (const year of [previousYear, currentYear]) {
    const [y1, y2] = year.name.split("–");
    await prisma.term.createMany({
      data: [
        {
          academicYearId: year.id,
          name: "Semester 1",
          nameKm: "ឆមាសទី១",
          ordinal: 1,
          startDate: toDbDate(`${y1}-11-03`),
          endDate: toDbDate(`${y2}-03-27`),
        },
        {
          academicYearId: year.id,
          name: "Semester 2",
          nameKm: "ឆមាសទី២",
          ordinal: 2,
          startDate: toDbDate(`${y2}-03-30`),
          endDate: toDbDate(`${y2}-08-07`),
        },
      ],
    });
  }

  const activeTerm = await prisma.term.findFirstOrThrow({
    where: { academicYearId: previousYear.id, ordinal: 2 },
  });

  console.log("Users…");
  const superAdmin = await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@sala.example.kh",
      passwordHash,
      displayName: "Sok Chanthou",
      displayNameKm: "សុខ ចន្ថូ",
      locale: Locale.EN,
      memberships: { create: { schoolId: school.id, role: Role.SUPER_ADMIN } },
    },
  });

  await prisma.user.create({
    data: {
      username: "office",
      email: "office@sala.example.kh",
      passwordHash,
      displayName: "Meas Sreyneang",
      displayNameKm: "មាស ស្រីនាង",
      locale: Locale.KM,
      memberships: { create: { schoolId: school.id, role: Role.SCHOOL_ADMIN } },
    },
  });

  const teacherSeeds = [
    ["Chan", "ចាន់", "Vanna", "វណ្ណា", Gender.FEMALE],
    ["Ly", "លី", "Piseth", "ពិសិដ្ឋ", Gender.MALE],
    ["Pich", "ពេជ្រ", "Bopha", "បុប្ផា", Gender.FEMALE],
    ["Seng", "សេង", "Rithy", "ឫទ្ធី", Gender.MALE],
    ["Heng", "ហេង", "Kunthea", "គន្ធា", Gender.FEMALE],
    ["Tep", "ទេព", "Sovann", "សុវណ្ណ", Gender.MALE],
    ["Nou", "នូ", "Theary", "ធារី", Gender.FEMALE],
    ["Prak", "ប្រាក់", "Veasna", "វាសនា", Gender.MALE],
    ["Yim", "យិម", "Chantrea", "ចន្ទ្រា", Gender.FEMALE],
    ["Mao", "ម៉ៅ", "Kosal", "កុសល", Gender.MALE],
  ] as const;

  const teachers = [];
  for (const [i, [fam, famKm, given, givenKm]] of teacherSeeds.entries()) {
    const user = await prisma.user.create({
      data: {
        username: `${given.toLowerCase()}.${fam.toLowerCase()}`,
        passwordHash,
        displayName: `${fam} ${given}`,
        displayNameKm: `${famKm} ${givenKm}`,
        locale: i % 3 === 0 ? Locale.EN : Locale.KM,
        memberships: { create: { schoolId: school.id, role: Role.TEACHER } },
      },
    });
    const profile = await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        schoolId: school.id,
        staffCode: `T${String(i + 1).padStart(3, "0")}`,
        phone: phone(),
        hireDate: toDbDate(`20${20 + (i % 6)}-11-03`),
      },
    });
    teachers.push(profile);
  }

  console.log("Classes…");
  const classPlan: [gradeOrdinal: number, suffix: string][] = [
    [0, "A"],
    [1, "A"],
    [1, "B"],
    [2, "A"],
    [2, "B"],
    [3, "A"],
    [3, "B"],
    [4, "A"],
    [5, "A"],
    [6, "A"],
  ];

  const classes = [];
  for (const [i, [ordinal, suffix]] of classPlan.entries()) {
    const grade = gradeLevels[ordinal];
    const homeroom = teachers[i % teachers.length];
    const klass = await prisma.class.create({
      data: {
        schoolId: school.id,
        academicYearId: previousYear.id,
        gradeLevelId: grade.id,
        name: `${grade.name} ${suffix}`,
        nameKm: `${grade.nameKm} ${suffix}`,
        room: `Room ${101 + i}`,
        homeroomTeacherId: homeroom.id,
        teachers: {
          create: [
            { teacherId: homeroom.id, role: ClassTeacherRole.HOMEROOM },
            {
              teacherId: teachers[(i + 3) % teachers.length].id,
              role: ClassTeacherRole.SUBJECT,
            },
          ],
        },
      },
    });
    classes.push(klass);
  }

  console.log(`Students (${STUDENT_COUNT}) and guardians…`);
  const now = today(school.timezone);

  for (let i = 0; i < STUDENT_COUNT; i++) {
    const [fam, famKm] = pick(FAMILY_NAMES);
    const isFemale = chance(0.5);
    const [given, givenKm] = isFemale
      ? pick(GIVEN_NAMES_FEMALE)
      : pick(GIVEN_NAMES_MALE);

    const klass = classes[i % classes.length];
    const gradeOrdinal = classPlan[i % classes.length][0];
    // Kindergarten is about five; each grade adds a year, with some spread.
    const age = 5 + gradeOrdinal + (chance(0.15) ? 1 : 0);
    const birthYear = Number(now.slice(0, 4)) - age;
    const [addr, addrKm] = pick(ADDRESSES);

    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        studentCode: `S${String(1000 + i)}`,
        firstName: given,
        lastName: fam,
        firstNameKm: givenKm,
        lastNameKm: famKm,
        englishName: chance(0.3) ? pick(ENGLISH_NAMES) : null,
        dateOfBirth: toDbDate(
          `${birthYear}-${String(between(1, 12)).padStart(2, "0")}-${String(
            between(1, 28),
          ).padStart(2, "0")}`,
        ),
        gender: isFemale ? Gender.FEMALE : Gender.MALE,
        enrollmentDate: toDbDate("2025-11-03"),
        address: addr,
        notes: chance(0.1) ? "Walks home with an older sibling." : null,
        medicalNote: chance(0.06) ? "Asthma — inhaler kept in the office." : null,
      },
    });

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        classId: klass.id,
        academicYearId: previousYear.id,
        startDate: toDbDate("2025-11-03"),
      },
    });

    // One or two guardians each, occasionally shared with a sibling already in
    // the school — the many-to-many is only exercised if the data uses it.
    const guardianCount = chance(0.75) ? 2 : 1;
    for (let g = 0; g < guardianCount; g++) {
      const isMother = g === 0 ? chance(0.6) : false;
      const [gGiven, gGivenKm] = isMother
        ? pick(GIVEN_NAMES_FEMALE)
        : pick(GIVEN_NAMES_MALE);

      const guardian = await prisma.guardian.create({
        data: {
          schoolId: school.id,
          name: `${fam} ${gGiven}`,
          nameKm: `${famKm} ${gGivenKm}`,
          phone: phone(),
          email: chance(0.25)
            ? `${gGiven.toLowerCase()}.${fam.toLowerCase()}@example.kh`
            : null,
          address: addr,
          preferredLocale: chance(0.8) ? Locale.KM : Locale.EN,
          occupation: pick([
            "Market trader",
            "Garment worker",
            "Motodop driver",
            "Teacher",
            "Farmer",
            "Shopkeeper",
            null,
          ]),
        },
      });

      await prisma.studentGuardian.create({
        data: {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: isMother
            ? GuardianRelationship.MOTHER
            : g === 0
              ? GuardianRelationship.FATHER
              : pick([
                  GuardianRelationship.FATHER,
                  GuardianRelationship.GRANDMOTHER,
                  GuardianRelationship.AUNT,
                  GuardianRelationship.UNCLE,
                ]),
          isPrimary: g === 0,
          isEmergencyContact: true,
          canPickUp: true,
        },
      });
    }

    // Reference the Khmer address so the field is populated for a few records
    // and the bilingual address display has something to show.
    if (chance(0.5)) {
      await prisma.student.update({
        where: { id: student.id },
        data: { address: addrKm },
      });
    }
  }

  console.log(`Attendance (${ATTENDANCE_DAYS} school days)…`);
  const enrollmentsByClass = new Map<string, string[]>();
  for (const klass of classes) {
    const rows = await prisma.enrollment.findMany({
      where: { classId: klass.id, status: "ENROLLED" },
      select: { studentId: true },
    });
    enrollmentsByClass.set(
      klass.id,
      rows.map((r) => r.studentId),
    );
  }

  const schoolDays: DateOnly[] = [];
  for (let back = 1; schoolDays.length < ATTENDANCE_DAYS; back++) {
    const day = addDays(now, -back);
    if (!isWeekend(day)) schoolDays.push(day);
  }

  for (const day of schoolDays) {
    for (const [i, klass] of classes.entries()) {
      // Not every class gets recorded every day — a school dashboard that never
      // shows a missing register is not telling the truth about school life.
      if (chance(0.06)) continue;

      const takenBy = teachers[i % teachers.length];
      const takerUser = await prisma.teacherProfile.findUniqueOrThrow({
        where: { id: takenBy.id },
        select: { userId: true },
      });

      const studentIds = enrollmentsByClass.get(klass.id) ?? [];
      if (studentIds.length === 0) continue;

      await prisma.attendanceSession.create({
        data: {
          classId: klass.id,
          date: toDbDate(day),
          takenByUserId: takerUser.userId,
          finalizedAt: new Date(),
          records: {
            create: studentIds.map((studentId) => {
              const roll = random();
              const status =
                roll < 0.915
                  ? AttendanceStatus.PRESENT
                  : roll < 0.955
                    ? AttendanceStatus.ABSENT
                    : roll < 0.985
                      ? AttendanceStatus.LATE
                      : roll < 0.996
                        ? AttendanceStatus.EXCUSED
                        : AttendanceStatus.LEFT_EARLY;
              return {
                studentId,
                status,
                minutesLate:
                  status === AttendanceStatus.LATE ? between(5, 40) : null,
                note:
                  status === AttendanceStatus.EXCUSED
                    ? "Family sent a note."
                    : null,
              };
            }),
          },
        },
      });
    }
  }

  console.log("Assessments and grades…");
  for (const klass of classes) {
    const studentIds = enrollmentsByClass.get(klass.id) ?? [];
    const homeroomUser = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: klass.homeroomTeacherId! },
      select: { userId: true },
    });

    for (const subject of subjects) {
      // PE is graded once; academic subjects a few times a semester.
      const count = subject.code === "PE" ? 1 : between(2, 4);

      for (let a = 0; a < count; a++) {
        const [title, titleKm] = pick(ASSESSMENT_TITLES);
        const maxScore = title === "Semester exam" ? 100 : pick([10, 20, 50]);

        const assessment = await prisma.assessment.create({
          data: {
            schoolId: school.id,
            classId: klass.id,
            subjectId: subject.id,
            termId: activeTerm.id,
            title,
            titleKm,
            date: toDbDate(schoolDays[between(0, schoolDays.length - 1)]),
            maxScore,
            weight: title === "Semester exam" ? 2 : 1,
            createdByUserId: homeroomUser.userId,
          },
        });

        await prisma.gradeRecord.createMany({
          data: studentIds.map((studentId) => {
            // A plausible spread: most of a primary class lands between 60% and
            // 95%, a few below, and occasionally a paper isn't marked yet.
            const ratio = Math.min(
              1,
              Math.max(0.25, 0.78 + (random() - 0.5) * 0.45),
            );
            return {
              assessmentId: assessment.id,
              studentId,
              score: chance(0.03)
                ? null
                : Math.round(maxScore * ratio * 2) / 2,
              enteredByUserId: homeroomUser.userId,
            };
          }),
        });
      }
    }
  }

  const counts = {
    students: await prisma.student.count(),
    guardians: await prisma.guardian.count(),
    classes: await prisma.class.count(),
    teachers: await prisma.teacherProfile.count(),
    attendanceRecords: await prisma.attendanceRecord.count(),
    grades: await prisma.gradeRecord.count(),
  };

  console.log("\nSeeded:", counts);
  console.log(`\nSign in with any of these — password: ${DEMO_PASSWORD}`);
  console.log("  admin              Super administrator");
  console.log("  office             School administrator");
  console.log("  vanna.chan         Teacher (homeroom of Kindergarten A)");
  console.log(`\nSuper admin id: ${superAdmin.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

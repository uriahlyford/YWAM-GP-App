import type { Messages } from "./en";

/**
 * Khmer (ភាសាខ្មែរ).
 *
 * Typed as `Messages`, so leaving a key out fails the build rather than falling
 * back to English somewhere a Khmer-speaking teacher would hit it.
 *
 * Vocabulary follows Cambodian Ministry of Education usage where there is one —
 * ឆមាស for a term, គ្រូបន្ទុកថ្នាក់ for a homeroom teacher, អាណាព្យាបាល for a
 * guardian. Recommend a Khmer-speaking teacher reads this file end to end before
 * the system goes in front of parents.
 */
export const km: Messages = {
  // --- Identity ---
  "app.name": "សាលា",
  "app.tagline": "ការគ្រប់គ្រងសាលារៀន",

  // --- Navigation ---
  "nav.dashboard": "ផ្ទាំងគ្រប់គ្រង",
  "nav.students": "សិស្ស",
  "nav.attendance": "វត្តមាន",
  "nav.grades": "ពិន្ទុ",
  "nav.classes": "ថ្នាក់",
  "nav.teachers": "គ្រូ",
  "nav.parents": "មាតាបិតា",
  "nav.reports": "របាយការណ៍",
  "nav.notifications": "ការជូនដំណឹង",
  "nav.settings": "ការកំណត់",
  "nav.audit": "កំណត់ហេតុសកម្មភាព",
  "nav.menu": "ម៉ឺនុយ",
  "nav.close": "បិទ",

  // --- Common actions ---
  "action.save": "រក្សាទុក",
  "action.saving": "កំពុងរក្សាទុក…",
  "action.saved": "បានរក្សាទុក",
  "action.cancel": "បោះបង់",
  "action.edit": "កែសម្រួល",
  "action.delete": "លុប",
  "action.archive": "ទុកក្នុងបណ្ណសារ",
  "action.restore": "ស្តារឡើងវិញ",
  "action.add": "បន្ថែម",
  "action.create": "បង្កើត",
  "action.search": "ស្វែងរក",
  "action.back": "ត្រឡប់ក្រោយ",
  "action.next": "បន្ទាប់",
  "action.previous": "មុន",
  "action.confirm": "បញ្ជាក់",
  "action.retry": "ព្យាយាមម្តងទៀត",
  "action.export": "នាំចេញ",
  "action.viewAll": "មើលទាំងអស់",
  "action.signIn": "ចូលប្រើ",
  "action.signOut": "ចាកចេញ",

  // --- Common words ---
  "common.name": "ឈ្មោះ",
  "common.nameKm": "ឈ្មោះជាភាសាខ្មែរ",
  "common.optional": "មិនចាំបាច់",
  "common.required": "ត្រូវការ",
  "common.yes": "បាទ/ចាស",
  "common.no": "ទេ",
  "common.none": "គ្មាន",
  "common.all": "ទាំងអស់",
  "common.today": "ថ្ងៃនេះ",
  "common.date": "កាលបរិច្ឆេទ",
  "common.time": "ម៉ោង",
  "common.status": "ស្ថានភាព",
  "common.notes": "កំណត់ចំណាំ",
  "common.phone": "លេខទូរស័ព្ទ",
  "common.email": "អ៊ីមែល",
  "common.address": "អាសយដ្ឋាន",
  "common.actions": "សកម្មភាព",
  "common.loading": "កំពុងផ្ទុក…",
  "common.empty": "មិនទាន់មានអ្វីនៅឡើយ",
  "common.of": "ក្នុងចំណោម",
  "common.language": "ភាសា",
  "common.total": "សរុប",

  // --- Errors ---
  "error.title": "មានបញ្ហាកើតឡើង",
  "error.generic": "មានបញ្ហាកើតឡើង។ សូមព្យាយាមម្តងទៀត។",
  "error.notFound": "រកមិនឃើញ",
  "error.notFound.body": "ទំព័រនេះមិនមានទេ ឬអ្នកមិនមានសិទ្ធិចូលមើល។",
  "error.forbidden": "អ្នកមិនមានសិទ្ធិចូលមើលទេ",
  "error.forbidden.body":
    "សូមសួរអ្នកគ្រប់គ្រងសាលា ប្រសិនបើអ្នកគិតថាអ្នកគួរតែមើលឃើញផ្នែកនេះ។",
  "error.required": "ត្រូវការបំពេញប្រអប់នេះ",
  "error.invalidPhone": "សូមបញ្ចូលលេខទូរស័ព្ទកម្ពុជាឱ្យបានត្រឹមត្រូវ",
  "error.invalidEmail": "សូមបញ្ចូលអ៊ីមែលឱ្យបានត្រឹមត្រូវ",
  "error.invalidDate": "សូមបញ្ចូលកាលបរិច្ឆេទឱ្យបានត្រឹមត្រូវ",

  // --- Sign in ---
  "auth.signIn.title": "ចូលប្រើ",
  "auth.signIn.subtitle": "សូមបញ្ចូលព័ត៌មានដែលសាលាបានផ្តល់ឱ្យអ្នក។",
  "auth.username": "ឈ្មោះអ្នកប្រើ",
  "auth.password": "ពាក្យសម្ងាត់",
  "auth.signingIn": "កំពុងចូលប្រើ…",
  "auth.invalidCredentials": "ឈ្មោះអ្នកប្រើ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។",
  "auth.accountLocked":
    "ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំពីរបីនាទី ឬសួរអ្នកគ្រប់គ្រង។",
  "auth.accountInactive": "គណនីនេះត្រូវបានបិទ។",
  "auth.signedOut": "អ្នកបានចាកចេញរួចរាល់។",
  "auth.sessionExpired": "វគ្គប្រើប្រាស់បានផុតកំណត់។ សូមចូលប្រើម្តងទៀត។",
  "auth.mustChangePassword": "សូមជ្រើសរើសពាក្យសម្ងាត់ថ្មី",
  "auth.mustChangePassword.body":
    "គណនីរបស់អ្នកកំពុងប្រើពាក្យសម្ងាត់បណ្តោះអាសន្ន។ សូមប្តូរជាពាក្យសម្ងាត់ផ្ទាល់ខ្លួនមុននឹងបន្ត។",
  "auth.newPassword": "ពាក្យសម្ងាត់ថ្មី",
  "auth.confirmPassword": "បញ្ជាក់ពាក្យសម្ងាត់ថ្មី",
  "auth.passwordMismatch": "ពាក្យសម្ងាត់ទាំងពីរមិនដូចគ្នាទេ។",
  "auth.passwordTooShort": "សូមប្រើយ៉ាងតិច ១០ តួអក្សរ។",
  "auth.passwordChanged": "បានប្តូរពាក្យសម្ងាត់រួចរាល់។",

  // --- Roles ---
  "role.SUPER_ADMIN": "អ្នកគ្រប់គ្រងជាន់ខ្ពស់",
  "role.SCHOOL_ADMIN": "អ្នកគ្រប់គ្រងសាលា",
  "role.TEACHER": "គ្រូ",
  "role.PARENT": "មាតាបិតា",

  // --- Attendance vocabulary ---
  "attendance.status.PRESENT": "មានវត្តមាន",
  "attendance.status.ABSENT": "អវត្តមាន",
  "attendance.status.LATE": "មកយឺត",
  "attendance.status.EXCUSED": "សុំច្បាប់",
  "attendance.status.LEFT_EARLY": "ចេញមុនម៉ោង",

  // --- Student vocabulary ---
  "student.status.ACTIVE": "កំពុងសិក្សា",
  "student.status.INACTIVE": "អសកម្ម",
  "student.status.GRADUATED": "បានបញ្ចប់ការសិក្សា",
  "student.status.TRANSFERRED": "បានផ្ទេរទៅសាលាផ្សេង",
  "student.status.WITHDRAWN": "បានឈប់រៀន",
  "gender.MALE": "ប្រុស",
  "gender.FEMALE": "ស្រី",
  "gender.OTHER": "ផ្សេងទៀត",

  // --- Guardian relationships ---
  "relationship.MOTHER": "ម្តាយ",
  "relationship.FATHER": "ឪពុក",
  "relationship.GRANDMOTHER": "ជីដូន",
  "relationship.GRANDFATHER": "ជីតា",
  "relationship.AUNT": "មីង",
  "relationship.UNCLE": "ពូ",
  "relationship.SIBLING": "បងប្អូន",
  "relationship.GUARDIAN": "អាណាព្យាបាល",
  "relationship.OTHER": "ផ្សេងទៀត",

  // --- Months ---
  "month.1": "មករា",
  "month.2": "កុម្ភៈ",
  "month.3": "មីនា",
  "month.4": "មេសា",
  "month.5": "ឧសភា",
  "month.6": "មិថុនា",
  "month.7": "កក្កដា",
  "month.8": "សីហា",
  "month.9": "កញ្ញា",
  "month.10": "តុលា",
  "month.11": "វិច្ឆិកា",
  "month.12": "ធ្នូ",

  // --- Weekdays ---
  "weekday.0": "អាទិត្យ",
  "weekday.1": "ចន្ទ",
  "weekday.2": "អង្គារ",
  "weekday.3": "ពុធ",
  "weekday.4": "ព្រហស្បតិ៍",
  "weekday.5": "សុក្រ",
  "weekday.6": "សៅរ៍",
};

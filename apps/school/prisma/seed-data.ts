/**
 * Name pools for the demo data.
 *
 * Real Cambodian family and given names with their Khmer spellings, because the
 * bilingual interface can only be judged against real script — placeholder Latin
 * names would never surface a line-height or wrapping problem, and those are
 * exactly the problems Khmer has.
 *
 * Khmer name order is family name first, which is why the seed writes
 * `lastName` from FAMILY_NAMES and never transliterates one field into another:
 * a student's Khmer and Latin names are both authoritative.
 */

export const FAMILY_NAMES: [latin: string, khmer: string][] = [
  ["Sok", "សុខ"],
  ["Chan", "ចាន់"],
  ["Kim", "គីម"],
  ["Ly", "លី"],
  ["Meas", "មាស"],
  ["Nou", "នូ"],
  ["Pich", "ពេជ្រ"],
  ["Prak", "ប្រាក់"],
  ["Ros", "រស់"],
  ["Sam", "សំ"],
  ["Seng", "សេង"],
  ["Thy", "ធី"],
  ["Vong", "វង្ស"],
  ["Yim", "យិម"],
  ["Heng", "ហេង"],
  ["Chea", "ជា"],
  ["Long", "ឡុង"],
  ["Mao", "ម៉ៅ"],
  ["Nhem", "ញ៉ែម"],
  ["Phon", "ផុន"],
  ["Rin", "រិន"],
  ["Sao", "សៅ"],
  ["Tep", "ទេព"],
  ["Ung", "អ៊ុង"],
  ["Khem", "ខែម"],
];

export const GIVEN_NAMES_MALE: [latin: string, khmer: string][] = [
  ["Dara", "ដារា"],
  ["Piseth", "ពិសិដ្ឋ"],
  ["Rithy", "ឫទ្ធី"],
  ["Sovann", "សុវណ្ណ"],
  ["Veasna", "វាសនា"],
  ["Kosal", "កុសល"],
  ["Samnang", "សំណាង"],
  ["Vibol", "វិបុល"],
  ["Pheakdey", "ភក្តី"],
  ["Sambath", "សម្បត្តិ"],
  ["Narin", "នរិន្ទ"],
  ["Sokhom", "សុខុម"],
  ["Vichea", "វិជ្ជា"],
  ["Panha", "បញ្ញា"],
  ["Makara", "មករា"],
  ["Sopheak", "សុភ័ក្ត្រ"],
  ["Chanthou", "ចន្ថូ"],
  ["Rotha", "រដ្ឋា"],
  ["Visal", "វិសាល"],
  ["Bunthoeun", "ប៊ុនធឿន"],
];

export const GIVEN_NAMES_FEMALE: [latin: string, khmer: string][] = [
  ["Sreyneang", "ស្រីនាង"],
  ["Bopha", "បុប្ផា"],
  ["Kunthea", "គន្ធា"],
  ["Theary", "ធារី"],
  ["Chantrea", "ចន្ទ្រា"],
  ["Malis", "ម៉ាលិស"],
  ["Nary", "នារី"],
  ["Phalla", "ផល្លា"],
  ["Ratana", "រតនា"],
  ["Sothea", "សុធា"],
  ["Kanha", "កញ្ញា"],
  ["Leakhena", "លក្ខិណា"],
  ["Nita", "នីតា"],
  ["Rasmey", "រស្មី"],
  ["Sina", "ស៊ីណា"],
  ["Thida", "ធីតា"],
  ["Chenda", "ចិន្តា"],
  ["Davy", "ដាវី"],
  ["Mealea", "មាលា"],
  ["Sokha", "សុខា"],
];

/** Many Cambodian students also use a chosen English name at school. */
export const ENGLISH_NAMES = [
  "Jenny",
  "Kevin",
  "Lily",
  "Bobby",
  "Anna",
  "David",
  "Mimi",
  "Tony",
  "Sophie",
  "Leo",
  "Nina",
  "Alex",
];

export const GRADE_LEVELS: [name: string, khmer: string][] = [
  ["Kindergarten", "មត្តេយ្យ"],
  ["Grade 1", "ថ្នាក់ទី១"],
  ["Grade 2", "ថ្នាក់ទី២"],
  ["Grade 3", "ថ្នាក់ទី៣"],
  ["Grade 4", "ថ្នាក់ទី៤"],
  ["Grade 5", "ថ្នាក់ទី៥"],
  ["Grade 6", "ថ្នាក់ទី៦"],
];

export const SUBJECTS: [code: string, name: string, khmer: string][] = [
  ["KHM", "Khmer", "ភាសាខ្មែរ"],
  ["MAT", "Mathematics", "គណិតវិទ្យា"],
  ["ENG", "English", "ភាសាអង់គ្លេស"],
  ["SCI", "Science", "វិទ្យាសាស្ត្រ"],
  ["SOC", "Social Studies", "សិក្សាសង្គម"],
  ["PE", "Physical Education", "អប់រំកាយ"],
];

/** Sangkat/khan addresses in Phnom Penh, for plausible-looking student records. */
export const ADDRESSES: [latin: string, khmer: string][] = [
  ["Sangkat Tuol Sangke, Khan Russey Keo", "សង្កាត់ទួលសង្កែ ខណ្ឌឫស្សីកែវ"],
  ["Sangkat Boeung Salang, Khan Toul Kork", "សង្កាត់បឹងសាឡាង ខណ្ឌទួលគោក"],
  ["Sangkat Chbar Ampov, Khan Chbar Ampov", "សង្កាត់ច្បារអំពៅ ខណ្ឌច្បារអំពៅ"],
  ["Sangkat Stung Meanchey, Khan Meanchey", "សង្កាត់ស្ទឹងមានជ័យ ខណ្ឌមានជ័យ"],
  ["Sangkat Phsar Depo, Khan Toul Kork", "សង្កាត់ផ្សារដេប៉ូ ខណ្ឌទួលគោក"],
  ["Sangkat Kakab, Khan Por Sen Chey", "សង្កាត់កាកាប ខណ្ឌពោធិ៍សែនជ័យ"],
];

export const ASSESSMENT_TITLES: [name: string, khmer: string][] = [
  ["Monthly test", "តេស្តប្រចាំខែ"],
  ["Quiz", "សំណួរខ្លី"],
  ["Homework", "លំហាត់ផ្ទះ"],
  ["Class work", "កិច្ចការក្នុងថ្នាក់"],
  ["Semester exam", "ប្រឡងឆមាស"],
];

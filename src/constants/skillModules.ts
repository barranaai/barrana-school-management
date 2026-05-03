/**
 * PRE-BUILT SKILL MODULES
 *
 * Quick-add structured content blocks that admins can insert into a
 * Report Template's "Template Content (Structured Format)" field.
 *
 * Each module uses the "Heading: ..." / "Subheading: ..." line format
 * so it works in two places at once:
 *
 *   1) AI Report Generation — the entire content block is passed to
 *      GPT-4 as the "Template Structure to Follow" prompt.
 *
 *   2) Teacher's pre-recording "Key Points to Observe & Discuss"
 *      checklist (StudentManagement.tsx parses lines prefixed with
 *      "Heading:" / "Subheading:" into a checkbox list).
 *
 * Adding a module appends its block to the existing Template Content;
 * the admin is free to edit, reorder, or remove any line afterward.
 */

export type SkillModuleCategory = 'development' | 'learning' | 'subject' | 'care';

export interface SkillModule {
  id: string;
  name: string;
  shortDescription: string;
  category: SkillModuleCategory;
  /** Marker line used to detect whether this module is already inserted. */
  marker: string;
  /** Structured content block that gets appended to Template Content. */
  content: string;
}

export const SKILL_MODULE_CATEGORY_LABELS: Record<SkillModuleCategory, string> = {
  development: 'Development Domains',
  learning: 'Learning Skills & Work Habits',
  subject: 'Subject Areas',
  care: 'Daily Care Items',
};

export const SKILL_MODULE_CATEGORY_DESCRIPTIONS: Record<SkillModuleCategory, string> = {
  development: 'Core child-development areas observed across all activities.',
  learning: 'Ontario-aligned learning skills and work habits, rated individually.',
  subject: 'Specific subject-based learning areas covered in the curriculum.',
  care: 'Daily care log items for daycare, infant, toddler, and preschool reports — meals, naps, diapers, mood, activities, and parent updates.',
};

/** Order in which categories appear in the UI. */
export const SKILL_MODULE_CATEGORY_ORDER: SkillModuleCategory[] = ['development', 'learning', 'subject', 'care'];

export const SKILL_MODULES: SkillModule[] = [
  // ──────────────────────── DEVELOPMENT DOMAINS ────────────────────────
  {
    id: 'cognitive',
    name: 'Cognitive Skills',
    shortDescription: 'Problem-solving, memory, focus, curiosity, instructions',
    category: 'development',
    marker: 'Heading: Cognitive Skills',
    content: `Heading: Cognitive Skills
Subheading: Problem-Solving — ability to work through challenges, logical thinking, and decision-making during play and structured activities.
Subheading: Memory & Recall — retention of names, routines, songs, and recognition of familiar patterns or sequences.
Subheading: Attention & Focus — ability to concentrate on tasks, sustained engagement, and focus during group or independent activities.
Subheading: Curiosity & Exploration — willingness to ask questions, explore new materials, and engage with unfamiliar concepts.
Subheading: Following Instructions — ability to understand and follow single-step or multi-step instructions.`,
  },
  {
    id: 'motor',
    name: 'Motor Skills',
    shortDescription: 'Gross motor, fine motor, coordination, balance',
    category: 'development',
    marker: 'Heading: Motor Skills',
    content: `Heading: Motor Skills
Subheading: Gross Motor — running, jumping, climbing, balance, and overall body coordination during outdoor or movement activities.
Subheading: Fine Motor — hand strength, pencil grip, use of scissors, manipulation of small objects, and precision tasks.
Subheading: Hand-Eye Coordination — threading, pouring, building with blocks, and accuracy in targeted movements.
Subheading: Self-Help & Independence — dressing, washing hands, opening containers, and other independent self-care motor tasks.
Subheading: Spatial Awareness — navigating space safely, judging distances, and moving around peers and objects.`,
  },
  {
    id: 'language',
    name: 'Language & Communication',
    shortDescription: 'Vocabulary, expression, comprehension, social communication',
    category: 'development',
    marker: 'Heading: Language & Communication',
    content: `Heading: Language & Communication
Subheading: Vocabulary & Expression — range of words used, sentence formation, and clarity when expressing thoughts or needs.
Subheading: Listening & Comprehension — ability to understand spoken language, follow stories, and respond to questions.
Subheading: Conversation Skills — turn-taking, staying on topic, and engaging in back-and-forth exchanges with peers and adults.
Subheading: Pre-Literacy / Literacy — interest in books, letter recognition, phonological awareness, and early reading or writing attempts.
Subheading: Non-Verbal Communication — eye contact, gestures, facial expressions, and use of body language to communicate.`,
  },
  {
    id: 'behavior',
    name: 'Behavior Tracking',
    shortDescription: 'Emotional regulation, social interaction, self-control',
    category: 'development',
    marker: 'Heading: Behavior Tracking',
    content: `Heading: Behavior Tracking
Subheading: Emotional Regulation — ability to manage frustration, handle transitions, and recover from upset moments.
Subheading: Social Interaction — sharing, cooperation with peers, empathy, and friendships formed in the classroom.
Subheading: Self-Control & Patience — waiting for turns, following classroom expectations, and impulse control.
Subheading: Respect & Responsibility — care for materials, respect for teachers and peers, and responsibility for personal belongings.
Subheading: Engagement & Attitude — overall enthusiasm, participation in group activities, and willingness to try new things.`,
  },

  // ─────────────────── LEARNING SKILLS & WORK HABITS (Ontario) ───────────────────
  {
    id: 'responsibility',
    name: 'Responsibility',
    shortDescription: 'Commitments, work completion, behavior management',
    category: 'learning',
    marker: 'Heading: Responsibility',
    content: `Heading: Responsibility
Subheading: Fulfils responsibilities and commitments within the learning environment.
Subheading: Completes and submits class work, homework, and assignments according to agreed-upon timelines.
Subheading: Takes responsibility for and manages own behavior.`,
  },
  {
    id: 'organization',
    name: 'Organization',
    shortDescription: 'Planning, prioritization, time management, resources',
    category: 'learning',
    marker: 'Heading: Organization',
    content: `Heading: Organization
Subheading: Devises and follows a plan and process for completing work and tasks.
Subheading: Establishes priorities and manages time to complete tasks and achieve goals.
Subheading: Identifies, gathers, evaluates, and uses information, technology, and resources to complete tasks.`,
  },
  {
    id: 'independent_work',
    name: 'Independent Work',
    shortDescription: 'Self-monitoring, time use, following instructions',
    category: 'learning',
    marker: 'Heading: Independent Work',
    content: `Heading: Independent Work
Subheading: Independently monitors, assesses, and revises plans to complete tasks and meet goals.
Subheading: Uses class time appropriately to complete tasks.
Subheading: Follows instructions with minimal supervision.`,
  },
  {
    id: 'collaboration',
    name: 'Collaboration',
    shortDescription: 'Group work, peer relationships, conflict resolution',
    category: 'learning',
    marker: 'Heading: Collaboration',
    content: `Heading: Collaboration
Subheading: Accepts various roles and an equitable share of work in a group.
Subheading: Responds positively to the ideas, opinions, values, and traditions of others.
Subheading: Builds healthy peer-to-peer relationships through personal and media-assisted interactions.
Subheading: Works with others to resolve conflicts and build consensus to achieve group goals.
Subheading: Shares information, resources, and expertise, and promotes critical thinking to solve problems and make decisions.`,
  },
  {
    id: 'initiative',
    name: 'Initiative',
    shortDescription: 'New ideas, innovation, curiosity, positive attitude',
    category: 'learning',
    marker: 'Heading: Initiative',
    content: `Heading: Initiative
Subheading: Looks for and acts on new ideas and opportunities for learning.
Subheading: Demonstrates the capacity for innovation and a willingness to take risks.
Subheading: Demonstrates curiosity and interest in learning.
Subheading: Approaches new tasks with a positive attitude.
Subheading: Recognizes and advocates appropriately for the rights of self and others.`,
  },
  {
    id: 'self_regulation',
    name: 'Self-Regulation',
    shortDescription: 'Goal-setting, self-reflection, perseverance',
    category: 'learning',
    marker: 'Heading: Self-Regulation',
    content: `Heading: Self-Regulation
Subheading: Sets own individual goals and monitors progress towards achieving them.
Subheading: Seeks clarification or assistance when needed.
Subheading: Assesses and reflects critically on own strengths, needs, and interests.
Subheading: Identifies learning opportunities, choices, and strategies to meet personal needs and achieve goals.
Subheading: Perseveres and makes an effort when responding to challenges.`,
  },

  // ──────────────────────── SUBJECT AREAS ────────────────────────
  {
    id: 'islamic_studies',
    name: 'Islamic Studies',
    shortDescription: 'Beliefs, prophets, manners, pillars, character values',
    category: 'subject',
    marker: 'Heading: Islamic Studies',
    content: `Heading: Islamic Studies
Subheading: Beliefs (Aqeedah) — understanding of Allah, prophets, angels, holy books, and the Day of Judgment at an age-appropriate level.
Subheading: Stories of the Prophets — recall of key prophet stories, lessons learned, and ability to discuss them.
Subheading: Manners & Etiquette (Adab) — greetings (Salam), eating manners, respect for parents, teachers, and peers.
Subheading: Pillars of Islam — awareness of the five pillars (Shahada, Salah, Zakat, Sawm, Hajj) and participation in age-appropriate practices.
Subheading: Character & Values — honesty, kindness, patience, gratitude, and other Islamic moral values demonstrated in daily behavior.`,
  },
  {
    id: 'islamic_development',
    name: 'Islamic Development',
    shortDescription: 'Worship practice, respect, etiquettes, conduct',
    category: 'subject',
    marker: 'Heading: Islamic Development',
    content: `Heading: Islamic Development
Subheading: Acts of Peace and Respect — regularly performs acts of peace and respect in classroom interactions.
Subheading: Respect for Others — respect shown to students, teachers, and staff in daily conduct.
Subheading: Wudu, Morning Ceremony, and Salah — performs them properly in a prayerful state, resisting disruption and temptation.
Subheading: Islamic Etiquettes — observance of Islamic manners (Adab) throughout the school day.
Subheading: Modesty & Conduct — behaves appropriately and modestly in interactions with the opposite sex.`,
  },
  {
    id: 'quran_memorization',
    name: 'Quran Memorization',
    shortDescription: 'Recitation, Tajweed, memorized Surahs, pronunciation',
    category: 'subject',
    marker: 'Heading: Quran Memorization',
    content: `Heading: Quran Memorization
Subheading: Surah Memorization — Surahs and verses memorized to date, accuracy, and fluency in recitation.
Subheading: Tajweed & Pronunciation — application of basic Tajweed rules, correct articulation (Makharij), and clarity of recitation.
Subheading: Recitation Confidence — willingness and confidence to recite individually and in group settings.
Subheading: Retention & Revision — ability to retain previously memorized Surahs and willingness to revise.
Subheading: Engagement with Quran — interest in Quran lessons, eagerness to memorize, and respect shown to the Mushaf.`,
  },
  {
    id: 'arabic',
    name: 'Arabic Language',
    shortDescription: 'Vocabulary, letters, reading, writing, speaking',
    category: 'subject',
    marker: 'Heading: Arabic Language',
    content: `Heading: Arabic Language
Subheading: Letter Recognition — recognition of the 28 Arabic letters, their forms (initial, medial, final), and corresponding sounds.
Subheading: Vocabulary — range of Arabic words known, ability to identify objects, colors, numbers, and basic phrases.
Subheading: Reading Skills — ability to read simple Arabic words, sentences, and short passages with correct pronunciation.
Subheading: Writing & Handwriting — formation of letters, writing words from right to left, and overall handwriting development.
Subheading: Speaking & Listening — ability to use simple Arabic phrases, respond to greetings, and understand basic spoken Arabic.`,
  },
  {
    id: 'quranic_arabic',
    name: 'Quranic Arabic',
    shortDescription: 'Quranic vocabulary, reading, Tajweed, translation',
    category: 'subject',
    marker: 'Heading: Quranic Arabic',
    content: `Heading: Quranic Arabic
Subheading: Quranic Vocabulary — knowledge of common Quranic Arabic words and their meanings.
Subheading: Reading Quranic Text — fluency in reading from the Mushaf with correct pronunciation.
Subheading: Tajweed Application — applying Tajweed rules accurately during Quranic Arabic reading.
Subheading: Translation Awareness — basic understanding of the meaning of memorized verses.
Subheading: Engagement — interest, focus, and motivation during Quranic Arabic lessons.`,
  },
  {
    id: 'french',
    name: 'French Language',
    shortDescription: 'Oral communication, vocabulary, reading, writing, listening',
    category: 'subject',
    marker: 'Heading: French Language',
    content: `Heading: French Language
Subheading: Oral Communication — ability to speak simple French phrases, pronunciation, and confidence when speaking.
Subheading: Vocabulary — range of French words known, ability to name objects, colors, numbers, and basic concepts.
Subheading: Reading & Phonics — recognition of French letter sounds, ability to read simple words, and early decoding skills.
Subheading: Writing — formation of letters, copying simple words, and early writing attempts in French.
Subheading: Listening Comprehension — ability to understand spoken French, follow instructions, and respond appropriately.`,
  },
  {
    id: 'english_language',
    name: 'Language (English)',
    shortDescription: 'Reading, Writing, Oral Communication, Media Literacy',
    category: 'subject',
    marker: 'Heading: Language (English)',
    content: `Heading: Language (English)
Subheading: Reading — comprehension, fluency, decoding, and engagement with a range of texts.
Subheading: Writing — sentence and paragraph structure, mechanics, and creative or informative composition.
Subheading: Oral Communication — speaking with purpose, listening actively, and contributing to discussions.
Subheading: Media Literacy — interpretation and creation of media texts and visual content.`,
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    shortDescription: 'Number, Algebra, Data, Spatial Sense, Financial Literacy',
    category: 'subject',
    marker: 'Heading: Mathematics',
    content: `Heading: Mathematics
Subheading: Number — number sense, operations, and quantitative reasoning.
Subheading: Algebra — patterns, relationships, and algebraic thinking.
Subheading: Data — collection, organization, display, and interpretation of data.
Subheading: Spatial Sense — geometry, measurement, and spatial reasoning.
Subheading: Financial Literacy — money concepts and age-appropriate financial decision-making.
Subheading: Social-Emotional Learning Skills — perseverance, identity, and well-being in mathematics.
Subheading: Mathematical Processes — problem-solving, reasoning, representing, communicating, and reflecting.`,
  },
  {
    id: 'science_technology',
    name: 'Science and Technology',
    shortDescription: 'Life Systems, Structures, Matter & Energy, Earth & Space',
    category: 'subject',
    marker: 'Heading: Science and Technology',
    content: `Heading: Science and Technology
Subheading: Life Systems — living things, ecosystems, biology, and biological processes.
Subheading: Structures and Mechanisms — design, function, and stability of structures.
Subheading: Matter and Energy — properties of matter, forms of energy, and their transformations.
Subheading: Earth and Space Systems — weather, soil, water, and astronomy concepts.`,
  },
  {
    id: 'social_studies',
    name: 'Social Studies',
    shortDescription: 'Heritage and Identity, People and Environments',
    category: 'subject',
    marker: 'Heading: Social Studies',
    content: `Heading: Social Studies
Subheading: Heritage and Identity — communities, traditions, cultural diversity, and personal identity.
Subheading: People and Environments — geographic awareness, civic responsibility, and societal interactions.`,
  },
  {
    id: 'the_arts',
    name: 'The Arts',
    shortDescription: 'Visual Arts, Music, Drama, Dance',
    category: 'subject',
    marker: 'Heading: The Arts',
    content: `Heading: The Arts
Subheading: Visual Arts — creating, presenting, and reflecting on artwork.
Subheading: Music — performing, creating, and responding to music.
Subheading: Drama — role-play, expression, and theatrical interpretation.
Subheading: Dance — movement, rhythm, and expressive performance.`,
  },
  {
    id: 'health_phys_ed',
    name: 'Health & Physical Education',
    shortDescription: 'Healthy Living, Active Living, Movement Competence',
    category: 'subject',
    marker: 'Heading: Health and Physical Education',
    content: `Heading: Health and Physical Education
Subheading: Healthy Living — nutrition, hygiene, safety, substance use awareness, and personal well-being.
Subheading: Health Living Skills — interpersonal skills, decision-making, and self-awareness in health contexts.
Subheading: Active Living — physical fitness, daily activity, and healthy participation.
Subheading: Movement Competence — body control, coordination, manipulation, and movement skills.
Subheading: PE Living Skills — sportsmanship, cooperation, and reflective participation.`,
  },

  // ──────────────────────── DAILY CARE ITEMS (Daycare / Infant / Toddler / Preschool) ────────────────────────
  {
    id: 'diaper-changes',
    name: 'Diaper Changes',
    shortDescription: 'Wet / BM / dry, time, condition (Infants & Toddlers)',
    category: 'care',
    marker: 'Heading: Diaper Changes',
    content: `Heading: Diaper Changes
Subheading: Times Changed — list each change with the time and who performed it.
Subheading: Diaper Type — wet, bowel movement, both, or dry at change.
Subheading: Skin Condition — note any redness, rash, or irritation observed at change.
Subheading: Supplies Used — cream, wipes, or diapers from the parent-supplied bag, including when stock is running low.
Subheading: Notes for Parent — any concerns or observations to share at pickup.`,
  },
  {
    id: 'bottle-feedings',
    name: 'Bottle Feedings',
    shortDescription: 'Time, amount, type, completion (Infants)',
    category: 'care',
    marker: 'Heading: Bottle Feedings',
    content: `Heading: Bottle Feedings
Subheading: Times Offered — list each bottle with the time it was given.
Subheading: Type — formula, expressed breastmilk, or other (as labelled by parent).
Subheading: Amount Offered & Taken — record amount in oz/ml offered and how much was finished.
Subheading: Acceptance — eager, calm, fussy, or refused; note any difficulty latching or burping.
Subheading: Spit-up or Concerns — any reflux, vomiting, or feeding concerns observed.`,
  },
  {
    id: 'meals-and-snacks',
    name: 'Meals & Snacks',
    shortDescription: 'Breakfast, lunch, snacks — what & how much (Toddlers+)',
    category: 'care',
    marker: 'Heading: Meals and Snacks',
    content: `Heading: Meals and Snacks
Subheading: Breakfast — foods offered, time served, and amount eaten (all / most / some / none).
Subheading: Morning Snack — items offered and amount eaten.
Subheading: Lunch — foods offered, time served, and amount eaten (all / most / some / none).
Subheading: Afternoon Snack — items offered and amount eaten.
Subheading: Hydration — water/milk offered and approximate intake throughout the day.
Subheading: Appetite & Preferences — appetite level, foods enjoyed or refused, any allergic reactions or sensitivities.`,
  },
  {
    id: 'bathroom-independence',
    name: 'Bathroom Independence',
    shortDescription: 'Independent visits, accidents, potty progress (Preschool+)',
    category: 'care',
    marker: 'Heading: Bathroom and Toileting',
    content: `Heading: Bathroom and Toileting
Subheading: Independent Visits — count and times of self-initiated bathroom use.
Subheading: Assisted Visits — when help was needed for wiping, flushing, or hand-washing.
Subheading: Accidents — frequency and circumstances; whether a change of clothes was needed.
Subheading: Potty Training Progress — milestones, recognition of cues, and consistency.
Subheading: Hygiene Routine — hand-washing, flushing, and self-care follow-through.`,
  },
  {
    id: 'naps-and-rest',
    name: 'Naps & Rest Time',
    shortDescription: 'Start, end, duration, quality (Infants–Preschool)',
    category: 'care',
    marker: 'Heading: Naps and Rest Time',
    content: `Heading: Naps and Rest Time
Subheading: Nap Times — start and end times for each nap throughout the day.
Subheading: Total Sleep — combined nap duration in minutes/hours.
Subheading: Sleep Quality — settled quickly, restless, woke early, or needed soothing.
Subheading: Sleeping Arrangement — crib, cot, mat, or held; back to sleep practice followed for infants.
Subheading: Quiet Time Activities — for non-nappers, what they did during rest period.`,
  },
  {
    id: 'mood-and-wellbeing',
    name: 'Mood & Emotional Wellbeing',
    shortDescription: 'Mood through the day, emotional regulation (All ages)',
    category: 'care',
    marker: 'Heading: Mood and Emotional Wellbeing',
    content: `Heading: Mood and Emotional Wellbeing
Subheading: Overall Mood — happy, calm, content, fussy, tired, or upset throughout the day.
Subheading: Drop-Off Transition — how the child settled in upon arrival.
Subheading: Emotional Regulation — ability to self-soothe, accept comfort, or recover from upset moments.
Subheading: Social Comfort — comfort with peers, teachers, and group activities.
Subheading: Notable Emotional Moments — any breakthroughs, big feelings, or comfort needs.`,
  },
  {
    id: 'daily-activities-and-play',
    name: 'Daily Activities & Play',
    shortDescription: 'Structured activities, free play, materials, engagement (All ages)',
    category: 'care',
    marker: 'Heading: Daily Activities and Play',
    content: `Heading: Daily Activities and Play
Subheading: Structured Activities — circle time, art, music, story, or themed lessons of the day.
Subheading: Free Play — choice of materials, peer interactions, and creativity observed.
Subheading: Sensory & Exploratory Play — water, sand, playdough, sensory bins, and exploration.
Subheading: Engagement Level — focus, participation, and enthusiasm during activities.
Subheading: New Skills or Discoveries — any new skill, word, or interest noticed today.`,
  },
  {
    id: 'outdoor-and-physical',
    name: 'Outdoor Time & Physical Activity',
    shortDescription: 'Duration, activity type, weather, gross-motor moments (All ages)',
    category: 'care',
    marker: 'Heading: Outdoor Time and Physical Activity',
    content: `Heading: Outdoor Time and Physical Activity
Subheading: Outdoor Time — duration, location (yard, park, walk), and weather conditions.
Subheading: Gross-Motor Activities — running, climbing, jumping, riding, or balance play.
Subheading: Group Games — cooperative or organized games and how the child participated.
Subheading: Sun-Safety & Hydration — sunscreen, hats, water breaks as appropriate.
Subheading: Safety Notes — any falls, bumps, or near-misses to flag for the parent.`,
  },
  {
    id: 'health-observations',
    name: 'Health Observations',
    shortDescription: 'Energy, appetite, illness signs, injuries (All ages)',
    category: 'care',
    marker: 'Heading: Health Observations',
    content: `Heading: Health Observations
Subheading: Energy Level — alert and active, low energy, or unusually tired.
Subheading: Appetite Changes — eating noticeably more or less than usual.
Subheading: Symptoms — fever, cough, runny nose, rash, vomiting, or diarrhea.
Subheading: Injuries or Incidents — bumps, scrapes, or accidents with time, location, and care provided.
Subheading: Medication Administered — name, dose, and time per parent's authorization.
Subheading: Allergic Reactions — any signs of an allergic response and action taken.`,
  },
  {
    id: 'communication-for-parents',
    name: 'Communication for Parents',
    shortDescription: 'Highlights, achievements, follow-ups for home (All ages)',
    category: 'care',
    marker: 'Heading: Communication for Parents',
    content: `Heading: Communication for Parents
Subheading: Highlights of the Day — favorite moments, accomplishments, and proud achievements.
Subheading: Things to Practice at Home — skills, words, or routines to reinforce.
Subheading: Supplies Needed — diapers, wipes, change of clothes, or items running low.
Subheading: Reminders — upcoming events, picture day, field trips, or parent meetings.
Subheading: Questions or Notes for Parent — anything the educator would like the parent to confirm or share.`,
  },
];

/**
 * Check whether a module's content is already present in the given text.
 * Detection is case-insensitive and tolerant of leading/trailing whitespace
 * around the marker line.
 */
export function isSkillModuleInserted(content: string, module: SkillModule): boolean {
  if (!content) return false;
  const haystack = content.toLowerCase();
  const needle = module.marker.toLowerCase();
  return haystack.includes(needle);
}

/** Return only modules in a specific category, preserving array order. */
export function getModulesByCategory(category: SkillModuleCategory): SkillModule[] {
  return SKILL_MODULES.filter((m) => m.category === category);
}

/**
 * PRE-BUILT TEMPLATE STARTERS
 *
 * Curated bundles of skill modules tuned for a specific use-case (e.g. a
 * "Daily Care Log" for an Infant room). Clicking a starter inserts every
 * module's content block in order, skipping any that are already present.
 *
 * Each starter only references existing module IDs — the actual content
 * lives in SKILL_MODULES, so a starter is just a curated playlist.
 */
export interface SkillModuleTemplate {
  id: string;
  name: string;
  shortDescription: string;
  /** Long-form description shown under the starter card. */
  description: string;
  /** Optional age-group tag rendered as a chip (e.g. "0–12 months"). */
  ageGroup?: string;
  /** Suggested template name an admin can adopt — purely informational. */
  suggestedTemplateName: string;
  /** Ordered list of SkillModule.id values to insert. */
  moduleIds: string[];
}

export const SKILL_MODULE_TEMPLATES: SkillModuleTemplate[] = [
  {
    id: 'daily-care-log-infants',
    name: 'Daily Care Log — Infants',
    shortDescription: 'Diapers, bottles, naps, mood, activities, health, parent updates',
    description:
      'A complete daily care log tailored for infant rooms. Captures diaper changes, bottle feedings, naps, mood, activities, health observations, and end-of-day notes for parents.',
    ageGroup: '0–12 months',
    suggestedTemplateName: 'Daily Care Log – Infants',
    moduleIds: [
      'diaper-changes',
      'bottle-feedings',
      'naps-and-rest',
      'mood-and-wellbeing',
      'daily-activities-and-play',
      'health-observations',
      'communication-for-parents',
    ],
  },
  {
    id: 'daily-care-log-toddlers',
    name: 'Daily Care Log — Toddlers',
    shortDescription: 'Diapers/potty, meals, naps, mood, play, outdoor, health, parent updates',
    description:
      'A complete daily care log tailored for toddler rooms. Covers diapering or potty progress, meals and snacks, naps, mood, structured and free play, outdoor time, health observations, and parent communication.',
    ageGroup: '1–3 years',
    suggestedTemplateName: 'Daily Care Log – Toddlers',
    moduleIds: [
      'diaper-changes',
      'meals-and-snacks',
      'naps-and-rest',
      'mood-and-wellbeing',
      'daily-activities-and-play',
      'outdoor-and-physical',
      'health-observations',
      'communication-for-parents',
    ],
  },
  {
    id: 'daily-care-log-preschool',
    name: 'Daily Care Log — Preschool',
    shortDescription: 'Bathroom, meals, rest, mood, activities, outdoor, health, parent updates',
    description:
      'A complete daily care log tailored for preschool rooms. Tracks independent bathroom use, meals and snacks, rest time, mood, activities, outdoor play, health observations, and parent communication.',
    ageGroup: '3–5 years',
    suggestedTemplateName: 'Daily Care Log – Preschool',
    moduleIds: [
      'bathroom-independence',
      'meals-and-snacks',
      'naps-and-rest',
      'mood-and-wellbeing',
      'daily-activities-and-play',
      'outdoor-and-physical',
      'health-observations',
      'communication-for-parents',
    ],
  },
];

/**
 * Resolve a starter template into its ordered list of SkillModule objects.
 * Silently skips any IDs that no longer exist (defensive against typos
 * or future module renames).
 */
export function getTemplateModules(template: SkillModuleTemplate): SkillModule[] {
  return template.moduleIds
    .map((id) => SKILL_MODULES.find((m) => m.id === id))
    .filter((m): m is SkillModule => Boolean(m));
}

/**
 * hashtag-strategy.js — Brand hashtag rules for The Steele Zone / Crystal Clear House
 *
 * Rules:
 *   - Brand tags applied to every post, every platform.
 *   - Category tags added when a content category is specified.
 *   - Platform caps enforced: Instagram ≤30, TikTok ≤5, Facebook ≤3, LinkedIn ≤5.
 *   - Tags are appended after two newlines so they don't break caption copy.
 *   - Caller can opt out by passing category = 'none'.
 */

// ── Brand tags (always included) ─────────────────────────────────────────────

const BRAND_TAGS = [
  '#TheSteezeZone',
  '#CrystalClearHouse',
  '#CrystalClearVoices',
];

// ── Category tag banks ───────────────────────────────────────────────────────

const CATEGORY_TAGS = {
  music: [
    '#DJLife', '#EDM', '#HouseMusic', '#DiscoVibes', '#MixTape',
    '#MusicProducer', '#LiveDJ', '#SoundDesign', '#BeatMaker', '#NightLife',
  ],
  ai: [
    '#AIAutomation', '#ArtificialIntelligence', '#MachinelearningLife',
    '#n8n', '#CrewAI', '#ClaudeAI', '#NoCode', '#LowCode',
    '#AIAgents', '#FutureOfWork',
  ],
  content: [
    '#ContentCreator', '#SocialMediaStrategy', '#CreatorEconomy',
    '#Reels', '#TikTokCreator', '#InstagramReels', '#VideoMarketing',
    '#DigitalMarketing', '#BrandBuilding', '#Storytelling',
  ],
  events: [
    '#EventPlanning', '#LiveEvent', '#NightClub', '#VIPExperience',
    '#EntertainmentLife', '#EventProfs', '#PopUp', '#GoodVibes',
  ],
  lifestyle: [
    '#BossVibes', '#EntrepreneurMindset', '#HustleCulture',
    '#BlackExcellence', '#Motivation', '#LevelUp', '#WinnerMindset',
  ],
  booking: [
    '#BookNow', '#HireMe', '#DJForHire', '#PrivateEvents',
    '#CorporateEvents', '#WeddingDJ', '#EventDJ',
  ],
};

// ── Platform caps ────────────────────────────────────────────────────────────

const PLATFORM_CAP = {
  instagram: 30,
  tiktok: 5,
  facebook: 3,
  linkedin: 5,
};

/**
 * Build a deduplicated, capped tag list for a given platform and category.
 *
 * @param {string} platform  - 'instagram' | 'tiktok' | 'facebook' | 'linkedin'
 * @param {string} [category] - key of CATEGORY_TAGS, or 'none' to skip categories
 * @returns {string[]} array of hashtag strings (e.g. ['#TheSteezeZone', ...])
 */
export function buildTags(platform, category = 'music') {
  if (category === 'none') return [];

  const cap = PLATFORM_CAP[platform] ?? 10;
  const categoryPool = CATEGORY_TAGS[category] ?? CATEGORY_TAGS.music;

  // Brand first, then category fill-in — never exceed cap
  const tags = [...BRAND_TAGS];
  for (const tag of categoryPool) {
    if (tags.length >= cap) break;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/**
 * Append hashtags to a post caption.
 * Returns the original text unchanged if the platform is unknown or category='none'.
 *
 * @param {string} text       - original post copy
 * @param {string} platform   - social platform
 * @param {string} [category] - content category (default 'music')
 * @returns {string}
 */
export function injectHashtags(text, platform, category = 'music') {
  const tags = buildTags(platform, category);
  if (tags.length === 0) return text;
  return `${text.trimEnd()}\n\n${tags.join(' ')}`;
}

/**
 * Strip all hashtags from a string.
 * Useful when passing copy to TTS — spoken hashtags sound terrible.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripHashtags(text) {
  return text.replace(/#\w+/g, '').replace(/\s{2,}/g, ' ').trim();
}

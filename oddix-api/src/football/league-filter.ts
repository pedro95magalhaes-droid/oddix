export type OddixFixtureLike = Record<string, any>;

function pickText(...values: any[]) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
    .join(' ')
    .trim();
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getOddixLeagueText(item: OddixFixtureLike) {
  const league = item?.league || item?.liga || item?.competition || item?.competicao || {};
  const raw = item?.broadageRaw || item?.flashScoreRaw || item?.raw || {};
  const tournament = raw?.tournament || raw?.torneio || raw?.competition || raw?.competicao || {};

  return pickText(
    league?.name,
    league?.nome,
    league?.country,
    league?.pais,
    league?.país,
    tournament?.name,
    tournament?.nome,
    tournament?.countryName,
    tournament?.country_name,
    tournament?.country,
    tournament?.pais,
    tournament?.país,
    raw?.league?.name,
    raw?.league?.nome,
    raw?.liga?.name,
    raw?.liga?.nome,
  );
}

const BLOCKED_PATTERNS = [
  /\bu\s?\d{2}\b/,
  /\bsub\s?\d{2}\b/,
  /\bunder\s?\d{2}\b/,
  /\byouth\b/,
  /\bjunior(s)?\b/,
  /\breserve(s)?\b/,
  /\breservas\b/,
  /\bamateur\b/,
  /\bamador\b/,
  /\bfriendly\b/,
  /\bfriendlies\b/,
  /\bamistoso(s)?\b/,
  /\bwomen\b/,
  /\bfeminino\b/,
  /\bfeminina\b/,
  /\besoccer\b/,
  /\be soccer\b/,
  /\bcyber\b/,
  /\bsimulated\b/,
  /\bsimulad[oa]\b/,
  /\bfiji\b/,
  /\bindia 1st league\b/,
  /\bindia\b/,
  /\biran 1st division\b/,
  /\biran\b/,
  /\baustralia.*npl.*u\s?20\b/,
];

const PRIORITY_PATTERNS = [
  /\bbrasil(eirao)? serie a\b/,
  /\bbrasil(eirao)? serie b\b/,
  /\bcopa do brasil\b/,
  /\blibertadores\b/,
  /\bsul americana\b/,
  /\bchampions league\b/,
  /\beuropa league\b/,
  /\bconference league\b/,
  /\bpremier league\b/,
  /\bchampionship\b/,
  /\bla liga\b/,
  /\bsegunda division\b/,
  /\bbundesliga\b/,
  /\bbundesliga 2\b/,
  /\bserie a\b/,
  /\bserie b\b/,
  /\bligue 1\b/,
  /\bligue 2\b/,
  /\bprimeira liga\b/,
  /\beredivisie\b/,
  /\bmls\b/,
  /\bmajor league soccer\b/,
  /\bargentina.*primera\b/,
  /\bprimera division\b/,
  /\bliga profesional\b/,
  /\bliga mx\b/,
  /\bconcacaf\b/,
];

export function isOddixBlockedLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixPriorityLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  return PRIORITY_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixLeagueAllowed(item: OddixFixtureLike) {
  if (process.env.ODDIX_LEAGUE_FILTER_ENABLED === 'false') return true;
  if (isOddixBlockedLeague(item)) return false;

  const priorityOnly = process.env.ODDIX_PRIORITY_LEAGUES_ONLY === 'true';
  if (priorityOnly) return isOddixPriorityLeague(item);

  return true;
}

export function getOddixFixtureDate(item: OddixFixtureLike) {
  return (
    item?.fixture?.date ||
    item?.jogo?.data ||
    item?.fixture?.data ||
    item?.date ||
    item?.data ||
    null
  );
}

export function isOddixFinishedFixture(item: OddixFixtureLike) {
  const status = item?.fixture?.status || item?.jogo?.status || item?.status || {};
  const short = String(status?.short || status?.curto || status?.shortName || '').toUpperCase();
  const long = normalizeText(status?.long || status?.name || status?.nome || '');

  return (
    ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'PST', 'WO', 'AWD'].includes(short) ||
    long.includes('finished') ||
    long.includes('finalizada') ||
    long.includes('finalizado') ||
    long.includes('match finished') ||
    long.includes('partida finalizada') ||
    long.includes('cancel') ||
    long.includes('postpon') ||
    long.includes('adiad')
  );
}

export function isOddixDashboardFixtureAllowed(item: OddixFixtureLike, hideFinishedAfterHours = 6) {
  if (!isOddixLeagueAllowed(item)) return false;

  if (!isOddixFinishedFixture(item)) return true;

  const rawDate = getOddixFixtureDate(item);
  if (!rawDate) return false;

  const fixtureTime = new Date(rawDate).getTime();
  if (Number.isNaN(fixtureTime)) return false;

  const ageHours = (Date.now() - fixtureTime) / 1000 / 60 / 60;
  return ageHours <= hideFinishedAfterHours;
}

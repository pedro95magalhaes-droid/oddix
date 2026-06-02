export type OddixFixtureLike = Record<string, any>;

function pickText(...values: any[]) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
    .join(' ')
    .trim();
}

function normalizeText(value: any) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./]/g, ' ')
    .replace(/[^a-z0-9\s()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTeamName(value: any) {
  return normalizeText(value)
    .replace(/\bfc\b/g, '')
    .replace(/\bsc\b/g, '')
    .replace(/\bec\b/g, '')
    .replace(/\bac\b/g, '')
    .replace(/\bclub\b/g, '')
    .replace(/\bclube\b/g, '')
    .replace(/\b2\b/g, 'ii')
    .replace(/\s+/g, ' ')
    .trim();
}

function getRawObject(item: OddixFixtureLike) {
  return (
    item?.sportScore6Raw ||
    item?.sportScoreRaw ||
    item?.flashScoreRaw ||
    item?.allScoresRaw ||
    item?.apiFootballRaw ||
    item?.broadageRaw ||
    item?.raw ||
    {}
  );
}

export function getOddixLeagueText(item: OddixFixtureLike) {
  const league = item?.league || item?.liga || item?.competition || item?.competicao || {};
  const section = item?.section || item?.secao || {};
  const challenge = item?.challenge || item?.campeonato || {};
  const country = item?.country || item?.pais || item?.país || {};
  const raw = getRawObject(item);
  const tournament = raw?.tournament || raw?.torneio || raw?.competition || raw?.competicao || {};

  return pickText(
    league?.name,
    league?.nome,
    league?.country,
    league?.pais,
    league?.país,
    league?.slug,
    section?.name,
    section?.nome,
    section?.country,
    section?.pais,
    section?.país,
    section?.slug,
    challenge?.name,
    challenge?.nome,
    challenge?.country,
    challenge?.pais,
    challenge?.país,
    challenge?.slug,
    country?.name,
    country?.nome,
    raw?.competition,
    raw?.competition_name,
    raw?.competitionName,
    raw?.country,
    raw?.country_name,
    raw?.countryName,
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

export function getOddixTeamsText(item: OddixFixtureLike) {
  const teams = item?.teams || item?.times || {};
  const home = teams?.home || teams?.casa || teams?.mandante || {};
  const away = teams?.away || teams?.fora || teams?.visitante || teams?.awayTeam || {};
  const raw = getRawObject(item);

  return pickText(
    home?.name,
    home?.nome,
    away?.name,
    away?.nome,
    item?.home,
    item?.away,
    item?.homeTeam,
    item?.awayTeam,
    item?.casa,
    item?.fora,
    raw?.home,
    raw?.away,
    raw?.home_name,
    raw?.away_name,
  );
}

export function getOddixFullSearchText(item: OddixFixtureLike) {
  return pickText(getOddixLeagueText(item), getOddixTeamsText(item));
}

const HARD_BLOCKED_PATTERNS = [
  /\bu\s?\d{2}\b/,
  /\bu-\s?\d{2}\b/,
  /\bsub\s?\d{2}\b/,
  /\bunder\s?\d{2}\b/,
  /\byouth\b/,
  /\bjunior(s)?\b/,
  /\breserve(s)?\b/,
  /\breservas\b/,
  /\breserva\b/,
  /\bamateur(s)?\b/,
  /\bamador(a|es)?\b/,
  /\bfriendly\b/,
  /\bfriendlies\b/,
  /\bamistoso(s)?\b/,
  /\binternational friendly\b/,
  /\bwomen\b/,
  /\bwoman\b/,
  /\bwomens\b/,
  /\bfemale\b/,
  /\bfeminino\b/,
  /\bfeminina\b/,
  /\bchampionship\s*\(w\)\b/,
  /\(\s*w\s*\)/,
  /\b\(w\)\b/,
  /\besoccer\b/,
  /\be soccer\b/,
  /\bcyber\b/,
  /\bsimulated\b/,
  /\bsimulad[oa]\b/,
  /\bmls next pro\b/,
  /\bnext pro\b/,
  /\bdevelopment league\b/,
  /\breserve league\b/,
];

const LOW_QUALITY_PATTERNS = [
  /\buniversity\b/,
  /\bfutsal\b/,
  /\bbeach soccer\b/,
  /\bschool\b/,
  /\bbupati\b/,
  /\bbeilu cup\b/,
  /\bteam\s+[a-z0-9]{4,}\b/,
  /\bregionalliga\b/,
  /\boberliga\b/,
  /\bsegunda division b\b/,
  /\bthird league\b/,
  /\bdivision 3\b/,
  /\bserie d\b/,
  /\bliga 3\b/,
  /\bleague two\b/,
  /\busl league two\b/,
  /\bprimera b metropolitana\b/,
  /\bstate league 1\b/,
  /\bqualification\b/,
];

const EXPLICIT_PRIORITY_SCORES: Array<[RegExp, number]> = [
  [/\bchampions league\b/, 100],
  [/\blibertadores\b/, 99],
  [/\bpremier league\b/, 98],
  [/\bla liga\b|\blaliga\b/, 97],
  [/\bserie a\b/, 96],
  [/\bbundesliga\b/, 95],
  [/\bligue 1\b/, 94],
  [/\beuropa league\b/, 93],
  [/\bconference league\b/, 91],
  [/\bbrasileirao\b|\bbrasileiro serie a\b|\bbrasil serie a\b|\bbrazil serie a\b/, 92],
  [/\bbrasileiro serie b\b|\bbrasil serie b\b|\bbrazil serie b\b|\bserie b\b/, 90],
  [/\bsudamericana\b|\bsul americana\b/, 88],
  [/\bcopa do brasil\b/, 88],
  [/\bcopa do nordeste\b/, 84],
  [/\bpaulista\b|\bcarioca\b|\bmineiro\b|\bgaucho\b|\bparanaense\b|\bpernambucano\b|\bcearense\b|\bbaiano\b|\bgoiano\b|\bcatarinense\b/, 82],
  [/\bargentina\b|\bprimera division\b/, 82],
  [/\bliga mx\b|\bmexico\b/, 84],
  [/\bmls\b/, 83],
  [/\bchampionship\b/, 82],
  [/\bere(divisie|divisie)\b/, 82],
  [/\bprimeira liga\b/, 82],
  [/\bj league\b|\bj1\b/, 80],
  [/\bk league\b/, 80],
  [/\bsaudi pro league\b/, 79],
  [/\bsuper lig\b|\bturkey\b/, 79],
  [/\bchile\b|\buruguay\b|\buruguai\b|\bparaguay\b|\bparaguai\b|\becuador\b|\bcolombia\b|\bperu\b|\bbolivia\b/, 78],
  [/\bworld cup\b|\bclub world cup\b|\bnations league\b|\beuro\b|\brecopa\b/, 90],
];

function explicitLeagueScore(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return 0;

  for (const [pattern, score] of EXPLICIT_PRIORITY_SCORES) {
    if (pattern.test(text)) return score;
  }

  return 0;
}

export function isOddixBlockedLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixFullSearchText(item));
  if (!text) return false;

  if (HARD_BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const blockLowQuality = process.env.ODDIX_BLOCK_LOW_QUALITY_LEAGUES === 'true';
  if (blockLowQuality && LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(text))) return true;

  return false;
}

export function isOddixPriorityLeague(item: OddixFixtureLike) {
  if (isOddixBlockedLeague(item)) return false;
  return explicitLeagueScore(item) >= 78;
}

export function isOddixSafeSecondaryLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  if (isOddixBlockedLeague(item)) return false;
  return getOddixFixtureQualityScore(item) >= Number(process.env.ODDIX_MIN_SECONDARY_SCORE || 60);
}

export function isOddixLeagueAllowed(item: OddixFixtureLike) {
  if (process.env.ODDIX_LEAGUE_FILTER_ENABLED === 'false') return true;
  if (isOddixBlockedLeague(item)) return false;

  const strictPriorityOnly = process.env.ODDIX_STRICT_PRIORITY_ONLY === 'true';
  if (strictPriorityOnly) return isOddixPriorityLeague(item);

  return true;
}

export function getOddixFixtureQualityScore(item: OddixFixtureLike) {
  if (!isOddixLeagueAllowed(item)) return 0;

  const leagueText = normalizeText(getOddixLeagueText(item));
  const teamsText = normalizeText(getOddixTeamsText(item));
  const fullText = normalizeText(getOddixFullSearchText(item));
  const provider = normalizeText(item?.provider || item?.provedor || '');

  let score = explicitLeagueScore(item) || 42;

  if (provider.includes('flashscore')) score += 8;
  if (provider.includes('sportscore6')) score += 6;
  if (provider.includes('api football')) score += 4;
  if (provider.includes('allscores')) score -= 2;

  const hasOdds = !!item?.odds || !!item?.odd;
  if (hasOdds) score += 6;

  const league = item?.league || item?.liga || {};
  const teams = item?.teams || item?.times || {};
  const home = teams?.home || teams?.casa || teams?.mandante || {};
  const away = teams?.away || teams?.fora || teams?.visitante || {};

  if (league?.logo || league?.logotipo) score += 2;
  if (home?.logo && away?.logo) score += 4;

  if (/(brazil|brasil|argentina|chile|uruguay|uruguai|paraguay|paraguai|ecuador|colombia|peru|mexico|usa|united states)/.test(leagueText)) {
    score += 4;
  }

  if (/(cup|copa|liga|league|serie|division|primera|premier|championship|brasileirao|brasileiro)/.test(leagueText)) {
    score += 2;
  }

  if (LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(fullText))) score -= 22;
  if (/\b(ii|b)\b/.test(teamsText) || /\b2\b/.test(teamsText)) score -= 8;
  if (/\bdivision 3\b|\bserie d\b|\bliga 3\b|\bleague two\b/.test(leagueText)) score -= 14;
  if (/\bunknown\b|\bdesconhecido\b|\bliga nao informada\b/.test(leagueText)) score -= 18;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getOddixFixtureQualityLabel(item: OddixFixtureLike) {
  const score = getOddixFixtureQualityScore(item);
  if (score >= 85) return 'premium';
  if (score >= 75) return 'boa';
  if (score >= 60) return 'normal';
  if (score > 0) return 'fraca';
  return 'bloqueada';
}

export function getOddixFixtureDate(item: OddixFixtureLike) {
  const fixture = item?.fixture || item?.jogo || item?.partida || {};
  return (
    fixture?.date ||
    fixture?.data ||
    fixture?.utcDate ||
    item?.start_at ||
    item?.startAt ||
    item?.date ||
    item?.data ||
    null
  );
}

export function isOddixFinishedFixture(item: OddixFixtureLike) {
  const status = item?.fixture?.status || item?.jogo?.status || item?.partida?.status || item?.status || {};
  const short = String(status?.short || status?.curto || status?.shortName || '').toUpperCase();
  const long = normalizeText(
    status?.long ||
      status?.name ||
      status?.nome ||
      status?.texto ||
      item?.status_text ||
      item?.statusText ||
      item?.status_more ||
      '',
  );

  return (
    ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'PST', 'WO', 'AWD'].includes(short) ||
    long.includes('finished') ||
    long.includes('finalizada') ||
    long.includes('finalizado') ||
    long.includes('partida finalizada') ||
    long.includes('match finished') ||
    long.includes('full time') ||
    long.includes('cancel') ||
    long.includes('postpon') ||
    long.includes('adiad') ||
    long.includes('abandon')
  );
}

export function isOddixDashboardFixtureAllowed(item: OddixFixtureLike, hideFinishedAfterHours = 0) {
  if (!isOddixLeagueAllowed(item)) return false;

  const minScore = Number(process.env.ODDIX_DASHBOARD_MIN_SCORE || 70);
  if (getOddixFixtureQualityScore(item) < minScore) return false;

  const showFinished = process.env.ODDIX_DASHBOARD_SHOW_FINISHED === 'true';
  const isFinished = isOddixFinishedFixture(item);

  if (isFinished && !showFinished) return false;

  const rawDate = getOddixFixtureDate(item);
  if (!rawDate) return false;

  const fixtureTime = new Date(rawDate).getTime();
  if (Number.isNaN(fixtureTime)) return false;

  const maxPastHours = Number(process.env.ODDIX_DASHBOARD_MAX_PAST_HOURS || 2);
  const minDate = Date.now() - maxPastHours * 60 * 60 * 1000;

  const maxFutureDays = Number(process.env.ODDIX_DASHBOARD_MAX_FUTURE_DAYS || 2);
  const maxDate = Date.now() + maxFutureDays * 24 * 60 * 60 * 1000;

  if (isFinished && showFinished && hideFinishedAfterHours > 0) {
    const maxFinishedAge = Date.now() - hideFinishedAfterHours * 60 * 60 * 1000;
    return fixtureTime >= maxFinishedAge && fixtureTime <= maxDate;
  }

  return fixtureTime >= minDate && fixtureTime <= maxDate;
}

export function getOddixFixtureDedupKey(item: OddixFixtureLike) {
  const rawDate = getOddixFixtureDate(item);
  const parsed = rawDate ? new Date(rawDate).getTime() : 0;
  const roundedTimestamp =
    parsed && !Number.isNaN(parsed)
      ? Math.floor(parsed / (15 * 60 * 1000)) * (15 * 60 * 1000)
      : Number(item?.fixture?.timestamp || item?.jogo?.timestamp || item?.timestamp || 0);

  const teams = item?.teams || item?.times || {};
  const home = normalizeTeamName(
    teams?.home?.name ||
      teams?.home?.nome ||
      teams?.casa?.name ||
      teams?.casa?.nome ||
      item?.homeTeam ||
      item?.home,
  );
  const away = normalizeTeamName(
    teams?.away?.name ||
      teams?.away?.nome ||
      teams?.fora?.name ||
      teams?.fora?.nome ||
      teams?.visitante?.name ||
      teams?.visitante?.nome ||
      item?.awayTeam ||
      item?.away,
  );

  return `${roundedTimestamp}-${home}-${away}`;
}

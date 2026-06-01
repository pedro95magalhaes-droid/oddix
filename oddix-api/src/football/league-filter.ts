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

/**
 * Bloqueio duro: só remove lixo claro.
 * Assim o Dashboard volta a ter volume, sem deixar passar U17/U19/U20/U21/U23,
 * feminino, reservas, amistosos, eSoccer e simulados.
 */
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

/**
 * Bloqueio opcional para ligas muito fracas. Só liga se quiser limpar bastante:
 * ODDIX_BLOCK_LOW_QUALITY_LEAGUES=true
 */
const LOW_QUALITY_PATTERNS = [
  /\buniversity\b/,
  /\bfutsal\b/,
  /\bbeach soccer\b/,
  /\bschool\b/,
  /\bbupati\b/,
  /\bbeilu cup\b/,
  /\bteam\s+[a-z0-9]{4,}\b/,
];

const PRIORITY_PATTERNS = [
  /\bchampions league\b/,
  /\beuropa league\b/,
  /\bconference league\b/,
  /\blibertadores\b/,
  /\bsudamericana\b/,
  /\brecopa\b/,
  /\bworld cup\b/,
  /\bclub world cup\b/,
  /\bnations league\b/,
  /\beuro\b/,
  /\bpremier league\b/,
  /\bchampionship\b/,
  /\bla liga\b/,
  /\blaliga\b/,
  /\bbundesliga\b/,
  /\bserie a\b/,
  /\bserie b\b/,
  /\bligue 1\b/,
  /\bere(divisie|divisie)\b/,
  /\bprimeira liga\b/,
  /\bbrasileirao\b/,
  /\bbrasileiro\b/,
  /\bbrazil serie\b/,
  /\bbrasil serie\b/,
  /\bcopa do brasil\b/,
  /\bcopa do nordeste\b/,
  /\bpaulista\b/,
  /\bcarioca\b/,
  /\bmineiro\b/,
  /\bgaucho\b/,
  /\bparanaense\b/,
  /\bpernambucano\b/,
  /\bcearense\b/,
  /\bbaiano\b/,
  /\bgoiano\b/,
  /\bcatarinense\b/,
  /\bpotiguar\b/,
  /\bparaense\b/,
  /\balagoano\b/,
  /\bsergipano\b/,
  /\bmaranhense\b/,
  /\bmato grossense\b/,
  /\bbrasiliense\b/,
  /\bargentina\b/,
  /\bchile\b/,
  /\buruguay\b/,
  /\bparaguay\b/,
  /\becuador\b/,
  /\bcolombia\b/,
  /\bperu\b/,
  /\bbolivia\b/,
  /\bmexico\b/,
  /\bliga mx\b/,
  /\bmls\b/,
  /\bj league\b/,
  /\bj1\b/,
  /\bk league\b/,
  /\bsaudi pro league\b/,
  /\bturkey\b/,
  /\bsuper lig\b/,
];

export function isOddixBlockedLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixFullSearchText(item));
  if (!text) return false;

  if (HARD_BLOCKED_PATTERNS.some((pattern) => pattern.test(text))) return true;

  const blockLowQuality = process.env.ODDIX_BLOCK_LOW_QUALITY_LEAGUES === 'true';
  if (blockLowQuality && LOW_QUALITY_PATTERNS.some((pattern) => pattern.test(text))) {
    return true;
  }

  return false;
}

export function isOddixPriorityLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  if (isOddixBlockedLeague(item)) return false;
  return PRIORITY_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixSafeSecondaryLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  if (isOddixBlockedLeague(item)) return false;
  return true;
}

export function isOddixLeagueAllowed(item: OddixFixtureLike) {
  if (process.env.ODDIX_LEAGUE_FILTER_ENABLED === 'false') return true;
  if (isOddixBlockedLeague(item)) return false;

  const premiumOnly = process.env.ODDIX_PRIORITY_LEAGUES_ONLY === 'true';
  if (premiumOnly) return isOddixPriorityLeague(item);

  // Modo recomendado: bloqueia só lixo claro e libera o restante.
  return true;
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

export function isOddixDashboardFixtureAllowed(
  item: OddixFixtureLike,
  hideFinishedAfterHours = 0,
) {
  if (!isOddixLeagueAllowed(item)) return false;

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

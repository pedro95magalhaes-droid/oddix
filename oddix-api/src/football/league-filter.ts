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
    .replace(/\bafc\b/g, '')
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
    item?.sportsDbRaw ||
    item?.footballDataRaw ||
    item?.fotmobRaw ||
    item?.raw ||
    {}
  );
}

function getObjectValue(obj: any, ...keys: string[]) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return '';
}

export function getOddixLeagueText(item: OddixFixtureLike) {
  const league = item?.league || item?.liga || item?.competition || item?.competicao || {};
  const section = item?.section || item?.secao || {};
  const challenge = item?.challenge || item?.campeonato || {};
  const country = item?.country || item?.pais || item?.país || {};
  const raw = getRawObject(item);
  const tournament = raw?.tournament || raw?.torneio || raw?.competition || raw?.competicao || {};

  return pickText(
    getObjectValue(league, 'name', 'nome', 'leagueName'),
    getObjectValue(league, 'country', 'pais', 'país', 'ccode'),
    league?.slug,
    getObjectValue(section, 'name', 'nome'),
    getObjectValue(section, 'country', 'pais', 'país', 'ccode'),
    section?.slug,
    getObjectValue(challenge, 'name', 'nome'),
    getObjectValue(challenge, 'country', 'pais', 'país', 'ccode'),
    challenge?.slug,
    getObjectValue(country, 'name', 'nome', 'code', 'ccode'),
    raw?.competition,
    raw?.competition_name,
    raw?.competitionName,
    raw?.leagueName,
    raw?.country,
    raw?.country_name,
    raw?.countryName,
    raw?.ccode,
    getObjectValue(tournament, 'name', 'nome'),
    getObjectValue(tournament, 'countryName', 'country_name', 'country', 'pais', 'país', 'ccode'),
    getObjectValue(raw?.league || {}, 'name', 'nome', 'leagueName'),
    getObjectValue(raw?.liga || {}, 'name', 'nome'),
  );
}

export function getOddixTeamsText(item: OddixFixtureLike) {
  const teams = item?.teams || item?.times || {};
  const home = teams?.home || teams?.casa || teams?.mandante || {};
  const away = teams?.away || teams?.fora || teams?.visitante || teams?.awayTeam || {};
  const raw = getRawObject(item);

  return pickText(
    getObjectValue(home, 'name', 'nome', 'longName', 'shortName'),
    getObjectValue(away, 'name', 'nome', 'longName', 'shortName'),
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
  /\bteam\s+[a-z0-9]{4,}\b/,
  /\bunknown\b/,
  /\bliga nao informada\b/,
];

const BRAZIL_LOW_DIVISION_PATTERNS = [
  /\bmaranhense\s*2\b/,
  /\bmaranhense\s*serie\s*b\b/,
  /\bparaense\s*a2\b/,
  /\bparaense\s*2\b/,
  /\bparanaense\s*a2\b/,
  /\bparanaense\s*2\b/,
  /\bpaulista\s*b\b/,
  /\bpaulista\s*a2\b/,
  /\bpaulista\s*a3\b/,
  /\bcarioca\s*2\b/,
  /\bcarioca\s*serie\s*a2\b/,
  /\bcarioca\s*a2\b/,
  /\bcatarinense\s*2\b/,
  /\bcatarinense\s*serie\s*b\b/,
  /\bcatarinense\s*b\b/,
  /\bmineiro\s*modulo\s*2\b/,
  /\bmineiro\s*modulo\s*ii\b/,
  /\bpernambucano\s*a2\b/,
  /\bcearense\s*2\b/,
  /\bbaiano\s*2\b/,
  /\bgoiano\s*2\b/,
  /\bgaucho\s*2\b/,
  /\bbrasiliense\s*2\b/,
  /\bpotiguar\s*2\b/,
  /\balagoano\s*2\b/,
  /\bsergipano\s*2\b/,
  /\bcapixaba\s*2\b/,
  /\bsegunda divisao\b/,
  /\bsegunda divisao\b/,
  /\b2a divisao\b/,
  /\b2ª divisao\b/,
  /\bsegundona\b/,
  /\ba2\b.*\bplay offs\b/,
];

const HARD_LOW_LEAGUE_PATTERNS = [
  ...BRAZIL_LOW_DIVISION_PATTERNS,
  /\bprimera b metropolitana\b/,
  /\bargentina\s*primera\s*b\b/,
  /\bprimera b\b/,
  /\bprimera c\b/,
  /\bprimera d\b/,
  /\bmetropolitana\b/,
  /\bregionalliga\b/,
  /\boberliga\b/,
  /\b4a liga\b/,
  /\b4 liga\b/,
  /\bquarta liga\b/,
  /\bleague two\b/,
  /\busl league two\b/,
  /\bstate league\b/,
  /\bvictoria premier league 2\b/,
  /\bqueensland premier league\b/,
  /\bcfa member\b/,
  /\bmember champions\b/,
  /\bsegunda classe\b/,
  /\bsegunda division b\b/,
  /\bthird league\b/,
  /\bdivision 3\b/,
  /\bserie d\b/,
  /\bliga 3\b/,
  /\bykkonen\b/,
  /\bazadegan\b/,
  /\bdivision di honor\b/,
  /\bqualification\b/,
  /\bj league 2\/3\b/,
  /\bplacement matches\b/,
  /\bindo\s*d[234]\b/,
  /\bindonesia\s*d[234]\b/,
  /\bpanama\s*lp\b/,
  /\bbra\s*lp\b/,
  /\bliga\s*4\b/,
  /\bd4\b/,
  /\bd3\b/,
  /\buniversity\b/,
  /\bfutsal\b/,
  /\bbeach soccer\b/,
  /\bschool\b/,
  /\bbupati\b/,
  /\bbeilu cup\b/,
];

const WEAK_COUNTRY_PATTERNS = [
  /\bsudan\b/,
  /\bsudao\b/,
  /\bsudao\b/,
  /\bsenegal\b/,
  /\bniger\b/,
  /\bgambia\b/,
  /\bsierra leone\b/,
  /\beth[ií]opia\b/,
  /\betiopia\b/,
  /\bdr congo\b/,
  /\brd congo\b/,
  /\bcongo\b/,
  /\blibya\b/,
  /\blibia\b/,
  /\birn\b/,
  /\biran\b/,
  /\biraq\b/,
  /\biraque\b/,
  /\bfinland\b/,
  /\bfinlandia\b/,
  /\bvietnam\b/,
  /\baruba\b/,
  /\bindonesia\b/,
  /\bmyanmar\b/,
  /\bcambodia\b/,
  /\bnepal\b/,
  /\bbangladesh\b/,
  /\bpanama\b/,
  /\blaos\b/,
];

function has(patterns: RegExp[], text: string) {
  return patterns.some((pattern) => pattern.test(text));
}

function providerText(item: OddixFixtureLike) {
  return normalizeText(item?.provider || item?.provedor || '');
}

function getProviderScore(item: OddixFixtureLike) {
  const provider = providerText(item);

  if (provider.includes('fotmob')) return 6;
  if (provider.includes('flashscore')) return 5;
  if (provider.includes('sportscore6')) return 3;
  if (provider.includes('api football')) return 2;
  if (provider.includes('allscores')) return -3;
  if (provider.includes('thesportsdb')) return -4;

  return 0;
}

function looksLikeBrazilMainRegional(text: string) {
  return /\bbrasil\b|\bbrazil\b|\bbrasileirao\b|\bbrasileiro\b|\bcopa do brasil\b|\bcopa do nordeste\b|\bpaulista\b|\bcarioca\b|\bmineiro\b|\bgaucho\b|\bparanaense\b|\bpernambucano\b|\bcearense\b|\bbaiano\b|\bgoiano\b|\bcatarinense\b|\bpotiguar\b|\bparaense\b|\balagoano\b|\bsergipano\b|\bmaranhense\b|\bbrasiliense\b/.test(text);
}

function isFriendlyText(text: string) {
  return /\bfriendly\b|\bfriendlies\b|\bamistoso\b|\bamistosos\b|\binternational friendly\b/.test(text);
}

function isSelectionFriendly(item: OddixFixtureLike, text: string) {
  if (!isFriendlyText(text)) return false;

  // FlashScore costuma mandar amistosos de seleções como MUNDIAL/WORLD + Friendly/Amistoso Internacional.
  if (/\bworld\b|\bmundial\b|\binternational\b|\binternacional\b|\bfifa\b|\bnational\b|\bselecoes\b|\bselecao\b/.test(text)) {
    return true;
  }

  const teamsText = normalizeText(getOddixTeamsText(item));
  const clubWords = /\bfc\b|\bsc\b|\bec\b|\bac\b|\bafc\b|\bclub\b|\bclube\b|\bcity\b|\bunited\b|\breserves\b|\bu\d{2}\b|\bsub\s?\d{2}\b/;
  if (clubWords.test(teamsText)) return false;

  return false;
}

function explicitLeagueScore(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return 0;

  if (has(WEAK_COUNTRY_PATTERNS, text)) return 0;
  if (has(HARD_LOW_LEAGUE_PATTERNS, text)) return 0;

  if (isSelectionFriendly(item, text)) return 72;
  if (isFriendlyText(text)) return 0;

  const rules: Array<[RegExp, number]> = [
    [/\buefa champions league\b|\bchampions league\b.*\buefa\b|\bchampions league\b/, 100],
    [/\bcopa libertadores\b|\blibertadores\b/, 99],
    [/\buefa europa league\b|\beuropa league\b/, 94],
    [/\buefa conference league\b|\bconference league\b/, 91],
    [/\bsudamericana\b|\bsul americana\b|\bcopa sudamericana\b/, 89],
    [/\brecopa sudamericana\b|\brecopa sul americana\b/, 86],
    [/\bfifa club world cup\b|\bclub world cup\b|\bmundial de clubes\b/, 92],
    [/\bworld cup qualifiers\b|\beliminatorias\b.*\bcopa\b|\bqualifiers\b.*\bworld cup\b/, 88],
    [/\bcopa america\b|\bcopa america\b|\bconmebol copa america\b/, 90],
    [/\beurocopa\b|\buefa euro\b|\beuro\b.*\bqualifiers\b|\beuropean championship\b/, 90],
    [/\buefa nations league\b|\bnations league\b/, 87],
    [/\bcopa do brasil\b/, 88],
    [/\bcopa do nordeste\b/, 82],
    [/\bfa cup\b|\befl cup\b|\bcarabao cup\b/, 83],
    [/\bcopa del rey\b|\bspanish cup\b/, 83],
    [/\bcoppa italia\b|\bitalian cup\b/, 83],
    [/\bdfb pokal\b|\bgerman cup\b/, 83],
    [/\bcoupe de france\b|\bfrench cup\b/, 82],
    [/\btaca de portugal\b|\bportuguese cup\b/, 81],
    [/\bcopa argentina\b/, 80],
    [/\bbrasileirao serie a\b|\bbrasileirao a\b|\bbrasileiro serie a\b|\bbrasil serie a\b|\bbrazil serie a\b/, 93],
    [/\bbrasileirao serie b\b|\bbrasileirao b\b|\bbrasileiro serie b\b|\bbrasil serie b\b|\bbrazil serie b\b/, 88],
    [/\bpaulista\b|\bcarioca\b|\bmineiro\b|\bgaucho\b|\bparanaense\b|\bpernambucano\b|\bcearense\b|\bbaiano\b|\bgoiano\b|\bcatarinense\b|\bpotiguar\b|\bparaense\b|\balagoano\b|\bsergipano\b|\bmaranhense\b|\bbrasiliense\b/, 72],
    [/\bengland\b.*\bpremier league\b|\binglaterra\b.*\bpremier league\b|\bepl\b/, 98],
    [/\bengland\b.*\bchampionship\b|\binglaterra\b.*\bchampionship\b|\befl championship\b/, 84],
    [/\bgermany\b.*\bbundesliga\b|\balemanha\b.*\bbundesliga\b|\bbundesliga\b/, 95],
    [/\bgermany\b.*\b2 bundesliga\b|\balemanha\b.*\b2 bundesliga\b|\b2 bundesliga\b|\bbundesliga 2\b/, 84],
    [/\bspain\b.*\bla liga\b|\bespanha\b.*\bla liga\b|\blaliga\b/, 97],
    [/\bspain\b.*\bsegunda\b|\bespanha\b.*\bsegunda\b|\bla liga 2\b|\blaliga 2\b/, 82],
    [/\bitaly\b.*\bserie a\b|\bitalia\b.*\bserie a\b|\bitalia\b.*\bserie a\b/, 96],
    [/\bitaly\b.*\bserie b\b|\bitalia\b.*\bserie b\b|\bitalia\b.*\bserie b\b/, 82],
    [/\bfrance\b.*\bligue 1\b|\bfranca\b.*\bligue 1\b|\bligue 1\b.*\bfrance\b/, 94],
    [/\bfrance\b.*\bligue 2\b|\bfranca\b.*\bligue 2\b/, 78],
    [/\bportugal\b.*\bprimeira liga\b|\bprimeira liga\b.*\bportugal\b|\bliga portugal\b/, 84],
    [/\bnetherlands\b.*\beredivisie\b|\bholanda\b.*\beredivisie\b|\beredivisie\b/, 83],
    [/\bargentina primera division\b|\bprimera division argentina\b|\bliga profesional\b|\bargentina\b.*\bliga profesional\b/, 84],
    [/\bliga mx\b|\bmexico\b.*\bliga mx\b|\bmexico\b.*\bprimera\b/, 84],
    [/\busa\b.*\bmls\b|\beua\b.*\bmls\b|\bmajor league soccer\b|\bmls\b/, 82],
    [/\busl championship\b|\busa\b.*\busl championship\b|\beua\b.*\busl championship\b/, 76],
    [/\bcolombia\b.*\bprimera\b|\bcolombia\b.*\bcopa colombia\b/, 76],
    [/\becuador\b.*\bserie a\b|\bligapro serie a\b/, 76],
    [/\bchile\b.*\bprimera\b|\buruguay\b.*\bprimera\b|\bparaguay\b.*\bprimera\b|\bparaguai\b.*\bprimera\b|\bperu\b.*\bprimera\b|\bbolivia\b.*\bprimera\b/, 76],
    [/\bjapan\b.*\bj1\b|\bjapao\b.*\bj1\b|\bj league\b|\bj1 league\b/, 78],
    [/\bkorea\b.*\bk league 1\b|\bcoreia\b.*\bk league 1\b|\bk league 1\b/, 78],
    [/\bsaudi pro league\b/, 77],
    [/\bturkey\b.*\bsuper lig\b|\bturquia\b.*\bsuper lig\b|\bsuper lig\b/, 77],
  ];

  for (const [pattern, score] of rules) {
    if (pattern.test(text)) return score;
  }

  return 0;
}

export function isOddixBlockedLeague(item: OddixFixtureLike) {
  const fullText = normalizeText(getOddixFullSearchText(item));
  const leagueText = normalizeText(getOddixLeagueText(item));
  if (!fullText) return false;

  if (has(HARD_BLOCKED_PATTERNS, fullText)) return true;
  if (has(WEAK_COUNTRY_PATTERNS, leagueText)) return true;
  if (has(HARD_LOW_LEAGUE_PATTERNS, leagueText)) return true;
  if (isFriendlyText(leagueText) && !isSelectionFriendly(item, leagueText)) return true;

  return false;
}

export function isOddixPriorityLeague(item: OddixFixtureLike) {
  if (isOddixBlockedLeague(item)) return false;
  return explicitLeagueScore(item) >= 76;
}

export function isOddixSafeSecondaryLeague(item: OddixFixtureLike) {
  if (isOddixBlockedLeague(item)) return false;
  return getOddixFixtureQualityScore(item) >= Number(process.env.ODDIX_MIN_SECONDARY_SCORE || 60);
}

export function isOddixLeagueAllowed(item: OddixFixtureLike) {
  if (process.env.ODDIX_LEAGUE_FILTER_ENABLED === 'false') return true;
  if (isOddixBlockedLeague(item)) return false;

  const strictPriorityOnly = process.env.ODDIX_STRICT_PRIORITY_ONLY === 'true';
  if (strictPriorityOnly) return isOddixPriorityLeague(item);

  const minAllowedScore = Number(process.env.ODDIX_MIN_ALLOWED_LEAGUE_SCORE || 60);
  return explicitLeagueScore(item) >= minAllowedScore;
}

export function getOddixFixtureQualityScore(item: OddixFixtureLike) {
  if (!isOddixLeagueAllowed(item)) return 0;

  const leagueText = normalizeText(getOddixLeagueText(item));
  const teamsText = normalizeText(getOddixTeamsText(item));

  const explicitScore = explicitLeagueScore(item);
  let score = explicitScore || 0;

  score += getProviderScore(item);

  const hasOdds = !!item?.odds || !!item?.odd;
  if (hasOdds && explicitScore >= 70) score += 5;
  if (hasOdds && explicitScore < 70) score += 2;

  const league = item?.league || item?.liga || {};
  const teams = item?.teams || item?.times || {};
  const home = teams?.home || teams?.casa || teams?.mandante || {};
  const away = teams?.away || teams?.fora || teams?.visitante || {};

  if ((league?.logo || league?.logotipo) && explicitScore >= 70) score += 2;
  if ((home?.logo || home?.logotipo) && (away?.logo || away?.logotipo) && explicitScore >= 70) score += 3;

  if (/\b(ii|b)\b/.test(teamsText) || /\b2\b/.test(teamsText)) score -= 8;
  if (/\bunknown\b|\bdesconhecido\b|\bliga nao informada\b/.test(leagueText)) score -= 18;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getOddixFixtureQualityLabel(item: OddixFixtureLike) {
  const score = getOddixFixtureQualityScore(item);
  if (score >= 90) return 'premium';
  if (score >= 80) return 'excelente';
  if (score >= 70) return 'boa';
  if (score > 0) return 'normal';
  return 'bloqueada';
}

export function getOddixFixtureDate(item: OddixFixtureLike) {
  const fixture = item?.fixture || item?.jogo || item?.partida || item?.disputa || {};
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
  const status =
    item?.fixture?.status ||
    item?.jogo?.status ||
    item?.partida?.status ||
    item?.disputa?.status ||
    item?.status ||
    {};

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
  if (isOddixBlockedLeague(item)) return false;
  if (!isOddixLeagueAllowed(item)) return false;

  const showFinished = process.env.ODDIX_DASHBOARD_SHOW_FINISHED === 'true';
  const isFinished = isOddixFinishedFixture(item);

  if (isFinished && !showFinished) return false;

  const rawDate = getOddixFixtureDate(item);
  if (!rawDate) return false;

  const fixtureTime = new Date(rawDate).getTime();
  if (Number.isNaN(fixtureTime)) return false;

  const maxPastHours = Number(process.env.ODDIX_DASHBOARD_MAX_PAST_HOURS || 24);
  const minDate = Date.now() - maxPastHours * 60 * 60 * 1000;

  const maxFutureDays = Number(process.env.ODDIX_DASHBOARD_MAX_FUTURE_DAYS || 3);
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

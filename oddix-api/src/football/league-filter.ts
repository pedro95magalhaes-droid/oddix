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
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getOddixLeagueText(item: OddixFixtureLike) {
  const league = item?.league || item?.liga || item?.competition || item?.competicao || {};
  const section = item?.section || item?.secao || {};
  const challenge = item?.challenge || item?.campeonato || {};
  const country = item?.country || item?.pais || item?.país || {};
  const raw = item?.sportScoreRaw || item?.flashScoreRaw || item?.broadageRaw || item?.raw || {};
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

const HARD_BLOCKED_PATTERNS = [
  /\bu\s?\d{2}\b/,
  /\bsub\s?\d{2}\b/,
  /\bunder\s?\d{2}\b/,
  /\byouth\b/,
  /\bjunior(s)?\b/,
  /\breserve(s)?\b/,
  /\breservas\b/,
  /\bamateur(s)?\b/,
  /\bamador(a|es)?\b/,
  /\bfriendly\b/,
  /\bfriendlies\b/,
  /\bamistoso(s)?\b/,
  /\bwomen\b/,
  /\bfemale\b/,
  /\bfeminino\b/,
  /\bfeminina\b/,
  /\besoccer\b/,
  /\be soccer\b/,
  /\bcyber\b/,
  /\bsimulated\b/,
  /\bsimulad[oa]\b/,

  // Ligas fracas que estavam poluindo a tela LIVE.
  /\bregional\b/,
  /\bregionalliga\b/,
  /\bpromotion\b/,
  /\bplay\s?off(s)?\b/,
  /\bplay offs\b/,
  /\btercera\b/,
  /\btercera rfef\b/,
  /\bsegunda rfef\b/,
  /\bdivision\s?2\b/,
  /\bdivision\s?3\b/,
  /\bdivision\s?4\b/,
  /\bsegunda division\b/,
  /\bsegunda divisao\b/,
  /\bsegunda división\b/,
  /\bliga\s?2\b/,
  /\bliga\s?3\b/,
  /\bliga\s?4\b/,
  /\bserie\s?c\b/,
  /\bserie\s?d\b/,
  /\bprimera\s?b\b/,
  /\bprimera\s?c\b/,
  /\bprimera nacional\b/,
  /\bnb\s?iii\b/,
  /\biii\b/,
  /\biii liga\b/,
  /\biv liga\b/,
  /\b3rd division\b/,
  /\bthird division\b/,
  /\bquarta\b/,
  /\bterceira\b/,
  /\blandesliga\b/,
  /\boberliga\b/,
  /\bcounty\b/,
  /\bdistrict\b/,

  // Países/torneios que estavam aparecendo e não entram no Oddix premium.
  /\bhungary\b/,
  /\bhungria\b/,
  /\bperu\b/,
  /\biceland\b/,
  /\bislandia\b/,
  /\bnorway\b/,
  /\bnoruega\b/,
  /\bsierra leone\b/,
  /\bmali\b/,
  /\biraq\b/,
  /\biraqi\b/,
  /\bsvenska cupen\b/,
  /\bcupen\b/,
  /\bportugal amateur\b/,
  /\bbosnia\b/,
  /\bromania\b/,
  /\bfiji\b/,
  /\bindia\b/,
  /\biran\b/,
];

// Lista premium do Oddix. Só essas ligas entram no Dashboard/LIVE por padrão.
const PREMIUM_PATTERNS = [
  /\bbrasil(eirao)? serie a\b/,
  /\bbrazil serie a\b/,
  /\bbrasileirao a\b/,
  /\bbrasileirao serie a\b/,
  /\bserie a brazil\b/,

  /\bbrasil(eirao)? serie b\b/,
  /\bbrazil serie b\b/,
  /\bbrasileirao b\b/,
  /\bbrasileirao serie b\b/,
  /\bserie b brazil\b/,

  /\bcopa do brasil\b/,
  /\blibertadores\b/,
  /\bconmebol libertadores\b/,
  /\bsul americana\b/,
  /\bsudamericana\b/,
  /\bconmebol sudamericana\b/,

  /\buefa champions league\b/,
  /\bchampions league\b/,
  /\buefa europa league\b/,
  /\beuropa league\b/,
  /\buefa conference league\b/,
  /\bconference league\b/,

  /\bengland premier league\b/,
  /\bpremier league\b/,
  /\bengland championship\b/,
  /\bchampionship\b/,

  /\bspain la liga\b/,
  /\bla liga\b/,
  /\blaliga\b/,

  /\bgermany bundesliga\b/,
  /\bbundesliga\b/,
  /\bgerman bundesliga 2\b/,
  /\bbundesliga 2\b/,
  /\b2 bundesliga\b/,

  /\bitaly serie a\b/,
  /\bserie a italy\b/,
  /\bitalia serie a\b/,
  /\bitaly serie b\b/,
  /\bserie b italy\b/,
  /\bitalia serie b\b/,

  /\bfrance ligue 1\b/,
  /\bligue 1\b/,

  /\bportugal primeira liga\b/,
  /\bprimeira liga\b/,

  /\bnetherlands eredivisie\b/,
  /\beredivisie\b/,

  /\bmajor league soccer\b/,
  /\bmls\b/,

  /\bargentina primera division\b/,
  /\bargentina liga profesional\b/,
  /\bliga profesional argentina\b/,

  /\bmexico liga mx\b/,
  /\bliga mx\b/,
];

export function isOddixBlockedLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  return HARD_BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixPriorityLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;

  // Evita falso positivo: "Mali Premier Division" não é Premier League.
  if (text.includes('premier division') && !text.includes('premier league')) return false;

  return PREMIUM_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixSafeSecondaryLeague(item: OddixFixtureLike) {
  // Desativado por padrão para limpar o Dashboard.
  // Se quiser liberar ligas secundárias no futuro, crie uma lista separada aqui.
  return false;
}

export function isOddixLeagueAllowed(item: OddixFixtureLike) {
  // Só desligue esse filtro manualmente se for depuração.
  if (process.env.ODDIX_LEAGUE_FILTER_ENABLED === 'false') return true;

  if (isOddixBlockedLeague(item)) return false;

  // Padrão agora é PREMIUM ONLY para não poluir com 300+ jogos fracos.
  return isOddixPriorityLeague(item);
}

export function getOddixFixtureDate(item: OddixFixtureLike) {
  return (
    item?.fixture?.date ||
    item?.jogo?.data ||
    item?.fixture?.data ||
    item?.start_at ||
    item?.startAt ||
    item?.date ||
    item?.data ||
    null
  );
}

export function isOddixFinishedFixture(item: OddixFixtureLike) {
  const status = item?.fixture?.status || item?.jogo?.status || item?.status || {};
  const short = String(status?.short || status?.curto || status?.shortName || '').toUpperCase();
  const long = normalizeText(status?.long || status?.name || status?.nome || item?.status_more || '');

  return (
    ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'PST', 'WO', 'AWD'].includes(short) ||
    long.includes('finished') ||
    long.includes('finalizada') ||
    long.includes('finalizado') ||
    long.includes('match finished') ||
    long.includes('partida finalizada') ||
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
  if (isOddixFinishedFixture(item)) return false;

  const rawDate = getOddixFixtureDate(item);
  if (!rawDate) return false;

  const fixtureTime = new Date(rawDate).getTime();
  if (Number.isNaN(fixtureTime)) return false;

  const maxPastHours = Number(process.env.ODDIX_DASHBOARD_MAX_PAST_HOURS || 2);
  const minDate = Date.now() - maxPastHours * 60 * 60 * 1000;

  const maxFutureDays = Number(process.env.ODDIX_DASHBOARD_MAX_FUTURE_DAYS || 2);
  const maxDate = Date.now() + maxFutureDays * 24 * 60 * 60 * 1000;

  return fixtureTime >= minDate && fixtureTime <= maxDate;
}

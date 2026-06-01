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
    .replace(/\bac\b/g, '')
    .replace(/\bclub\b/g, '')
    .replace(/\b2\b/g, 'ii')
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

export function getOddixTeamsText(item: OddixFixtureLike) {
  const teams = item?.teams || item?.times || {};
  const home = teams?.home || teams?.casa || teams?.mandante || {};
  const away = teams?.away || teams?.fora || teams?.visitante || {};

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
  );
}

export function getOddixFullSearchText(item: OddixFixtureLike) {
  return pickText(getOddixLeagueText(item), getOddixTeamsText(item));
}

/**
 * Bloqueio duro: só lixo claro.
 * Mantemos feminino bloqueado, como pedido.
 */
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
  /\bwoman\b/,
  /\bwomens\b/,
  /\bfemale\b/,
  /\bfeminino\b/,
  /\bfeminina\b/,
  /\bchampionship\s*\(w\)\b/,
  /\(\s*w\s*\)/,
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

const PREMIUM_PATTERNS = [
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
    // Estaduais / Regionais Brasil
  /\bcampeonato paulista\b/,
  /\bpaulista\b/,

  /\bcampeonato carioca\b/,
  /\bcarioca\b/,

  /\bcampeonato mineiro\b/,
  /\bmineiro\b/,

  /\bcampeonato gaucho\b/,
  /\bgaucho\b/,

  /\bcampeonato paranaense\b/,
  /\bparanaense\b/,

  /\bcampeonato pernambucano\b/,
  /\bpernambucano\b/,

  /\bcampeonato cearense\b/,
  /\bcearense\b/,

  /\bcampeonato baiano\b/,
  /\bbaiano\b/,

  /\bcampeonato goiano\b/,
  /\bgoiano\b/,

  /\bcampeonato catarinense\b/,
  /\bcatarinense\b/,

  /\bcampeonato potiguar\b/,
  /\bpotiguar\b/,

  /\bcampeonato paraense\b/,
  /\bparaense\b/,

  /\bcampeonato alagoano\b/,
  /\balagoano\b/,

  /\bcampeonato sergipano\b/,
  /\bsergipano\b/,

  /\bcampeonato maranhense\b/,
  /\bmaranhense\b/,

  /\bcampeonato mato grossense\b/,
  /\bmato grossense\b/,

  /\bcampeonato brasiliense\b/,
  /\bbrasiliense\b/,
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
];

const SAFE_SECONDARY_PATTERNS = [
  /\bchile\b/,
  /\bchi liga\b/,
  /\bchilean\b/,
  /\buruguay\b/,
  /\buruguayan\b/,
  /\bcolombia\b/,
  /\bcolombian\b/,
  /\becuador\b/,
  /\becuadorian\b/,
  /\bperu primera\b/,
  /\bparaguay\b/,
  /\bbolivian primera\b/,
  /\bcosta rica\b/,
  /\baustria bundesliga\b/,
  /\bswitzerland\b/,
  /\bswiss\b/,
  /\bbelgium\b/,
  /\bbelgian\b/,
  /\bdenmark\b/,
  /\bdanish\b/,
  /\bsweden allsvenskan\b/,
  /\bnorway eliteserien\b/,
  /\bjapan j1\b/,
  /\bj league\b/,
  /\bkorea k league\b/,
  /\bchina super league\b/,
  /\bsaudi pro league\b/,
  /\bturkey super lig\b/,
  /\bgreece super league\b/,
  /\bpoland ekstraklasa\b/,
  /\bcroatia hnl\b/,
  /\bserbia superliga\b/,
  /\bromania super liga\b/,
  /\baustralia a league\b/,
  /\bcanadian premier league\b/,
  /\bbrazil\b/,
  /\bbrasil\b/,
];

export function isOddixBlockedLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixFullSearchText(item));
  if (!text) return false;
  return HARD_BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixPriorityLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;

  if (text.includes('mls next pro') || text.includes('next pro')) return false;
  if (/\(\s*w\s*\)/.test(text) || text.includes('women') || text.includes('feminino')) return false;

  return PREMIUM_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixSafeSecondaryLeague(item: OddixFixtureLike) {
  const text = normalizeText(getOddixLeagueText(item));
  if (!text) return false;
  if (isOddixBlockedLeague(item)) return false;
  return SAFE_SECONDARY_PATTERNS.some((pattern) => pattern.test(text));
}

export function isOddixLeagueAllowed(item: OddixFixtureLike) {
  if (process.env.ODDIX_LEAGUE_FILTER_ENABLED === 'false') return true;
  if (isOddixBlockedLeague(item)) return false;

  const premiumOnly = process.env.ODDIX_PRIORITY_LEAGUES_ONLY === 'true';

  if (isOddixPriorityLeague(item)) return true;
  if (!premiumOnly && isOddixSafeSecondaryLeague(item)) return true;

  return false;
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

  // Agora aceita jogos futuros para pré-jogo/dashboard.
  const maxFutureDays = Number(process.env.ODDIX_DASHBOARD_MAX_FUTURE_DAYS || 7);
  const maxDate = Date.now() + maxFutureDays * 24 * 60 * 60 * 1000;

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
    teams?.home?.name || teams?.home?.nome || teams?.casa?.name || teams?.casa?.nome,
  );
  const away = normalizeTeamName(
    teams?.away?.name || teams?.away?.nome || teams?.fora?.name || teams?.fora?.nome,
  );

  return `${roundedTimestamp}-${home}-${away}`;
}
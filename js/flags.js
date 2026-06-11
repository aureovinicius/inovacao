// Bandeiras servidas LOCALMENTE (mesma origem), em /flags.
// Motivo: CDNs externos de escudos (crests.football-data.org, flagcdn) são
// bloqueados por firewall/antivírus em muitas redes corporativas — e a bandeira
// ficava como "imagem quebrada". Servindo do próprio site, nunca é bloqueada e
// funciona offline. Como são seleções nacionais, usamos a bandeira do país.
// SVGs do projeto flag-icons (MIT). Inglaterra/Escócia usam as bandeiras do Reino Unido.
export const CC_BY_TLA = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at', BEL: 'be', BIH: 'ba', BRA: 'br', CAN: 'ca',
  CIV: 'ci', COD: 'cd', COL: 'co', CPV: 'cv', CRO: 'hr', CUW: 'cw', CZE: 'cz', ECU: 'ec',
  EGY: 'eg', ENG: 'gb-eng', ESP: 'es', FRA: 'fr', GER: 'de', GHA: 'gh', HAI: 'ht', IRN: 'ir',
  IRQ: 'iq', JOR: 'jo', JPN: 'jp', KOR: 'kr', KSA: 'sa', MAR: 'ma', MEX: 'mx', NED: 'nl',
  NOR: 'no', NZL: 'nz', PAN: 'pa', PAR: 'py', POR: 'pt', QAT: 'qa', RSA: 'za', SCO: 'gb-sct',
  SEN: 'sn', SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr', URY: 'uy', USA: 'us', UZB: 'uz',
};

// Caminho local da bandeira de uma seleção (por TLA). '' se não mapeada.
export function flagPath(team) {
  const cc = CC_BY_TLA[(team?.tla || '').toUpperCase()];
  return cc ? `./flags/${cc}.svg` : '';
}

/**
 * getLate.dev Account Mapping
 * Maps Supabase scheduled_posts account_handle to getLate.dev account IDs and profile IDs.
 */

const LATE_ACCOUNT_MAP = {
  // TRIPSKIP_1
  'tiktok::latestartinvestor':        { accountId: '6996667a8ab8ae478b35a851', profileId: '6996655e67984a7ce17a3726' },
  'instagram::tripskipit':            { accountId: '699666928ab8ae478b35a862', profileId: '6996655e67984a7ce17a3726' },
  'facebook::damians hosting hub':    { accountId: '699666d78ab8ae478b35a896', profileId: '6996655e67984a7ce17a3726' },
  'facebook::damianshostinghub':      { accountId: '699666d78ab8ae478b35a896', profileId: '6996655e67984a7ce17a3726' },
  'youtube::damegarcia':              { accountId: '699667098ab8ae478b35a8b8', profileId: '6996655e67984a7ce17a3726' },
  'linkedin::damian garcia':          { accountId: '6996673f8ab8ae478b35a9cf', profileId: '6996655e67984a7ce17a3726' },
  'twitter::lateinvestor44':          { accountId: '699667578ab8ae478b35a9de', profileId: '6996655e67984a7ce17a3726' },
  'threads::tripskipit':              { accountId: '699669708ab8ae478b35ac1b', profileId: '6996655e67984a7ce17a3726' },
  'pinterest::8e3d6110149db3243c941fc83902a3': { accountId: '699669aa8ab8ae478b35ac47', profileId: '6996655e67984a7ce17a3726' },
  'reddit::anxious_country_7543':     { accountId: '69966a288ab8ae478b35acbb', profileId: '6996655e67984a7ce17a3726' },
  'googlebusiness::damians hosting hub': { accountId: '69986c568ab8ae478b381a8d', profileId: '6996655e67984a7ce17a3726' },

  // TRIPSKIP 2
  'tiktok::tripskiptexas':            { accountId: '69977f4d8ab8ae478b36ef9d', profileId: '699663708b0a5704dc2688ac' },
  'instagram::damianshostinghub':     { accountId: '69977ffe8ab8ae478b36f0a2', profileId: '699663708b0a5704dc2688ac' },
  'facebook::damians hosting hub 2':  { accountId: '699780608ab8ae478b36f113', profileId: '699663708b0a5704dc2688ac' },
  'youtube::tripskip-z9k':            { accountId: '699780c08ab8ae478b36f173', profileId: '699663708b0a5704dc2688ac' },
  'youtube::tripskip':                { accountId: '699780c08ab8ae478b36f173', profileId: '699663708b0a5704dc2688ac' },
  'linkedin::tripskip undefined':     { accountId: '6997817c8ab8ae478b36f260', profileId: '699663708b0a5704dc2688ac' },
  'linkedin::tripskip':               { accountId: '6997817c8ab8ae478b36f260', profileId: '699663708b0a5704dc2688ac' },
  'twitter::damiangarc75221':         { accountId: '699781df8ab8ae478b36f2c9', profileId: '699663708b0a5704dc2688ac' },
  'threads::damianshostinghub':       { accountId: '699783028ab8ae478b36f422', profileId: '699663708b0a5704dc2688ac' },
  'pinterest::tripskipit':            { accountId: '6997867b8ab8ae478b36f864', profileId: '699663708b0a5704dc2688ac' },

  // Tripskip 3
  'tiktok::tripskip.californ':        { accountId: '69978a998ab8ae478b36fe43', profileId: '69978a8e67fd8ccba6e55b59' },
  'instagram::tripskiptexas':         { accountId: '69978d768ab8ae478b37016e', profileId: '69978a8e67fd8ccba6e55b59' },
  'linkedin::damian  garcia':         { accountId: '69978d528ab8ae478b370150', profileId: '69978a8e67fd8ccba6e55b59' },
  'twitter::tripskipit':              { accountId: '69978bde8ab8ae478b36ffaf', profileId: '69978a8e67fd8ccba6e55b59' },

  // TRIPSKIP4
  'tiktok::tripskip3':                { accountId: '699e7fd38ab8ae478b42953b', profileId: '699e7fc7a8b8525f61be70fc' },
  'instagram::tripskipcali':          { accountId: '699e81198ab8ae478b42966f', profileId: '699e7fc7a8b8525f61be70fc' },
};

function lookupLateAccount(platform, accountHandle) {
  const handle = (accountHandle || '').toLowerCase().trim().replace(/^@/, '');
  const plat = (platform || '').toLowerCase().trim();
  
  let key = plat + '::' + handle;
  if (LATE_ACCOUNT_MAP[key]) return LATE_ACCOUNT_MAP[key];
  
  key = plat + '::' + handle.replace(/\s+/g, '');
  if (LATE_ACCOUNT_MAP[key]) return LATE_ACCOUNT_MAP[key];
  
  return null;
}

module.exports = { LATE_ACCOUNT_MAP, lookupLateAccount };

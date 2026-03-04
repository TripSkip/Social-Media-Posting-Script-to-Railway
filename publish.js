const { createClient } = require('@supabase/supabase-js');
const { lookupLateAccount } = require('./account-mapping');

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  lateApiKey: process.env.LATE_API_KEY,
  timezone: process.env.TIMEZONE || 'America/New_York',
  lateBaseUrl: 'https://getlate.dev/api/v1',
  platformLimits: {
    tiktok:    { maxPerDay: 4,  minGapMinutes: 180 },
    instagram: { maxPerDay: 4,  minGapMinutes: 240 },
    pinterest: { maxPerDay: 15, minGapMinutes: 30  },
    youtube:   { maxPerDay: 3,  minGapMinutes: 240 },
    facebook:  { maxPerDay: 2,  minGapMinutes: 360 },
    twitter:   { maxPerDay: 6,  minGapMinutes: 120 },
    threads:   { maxPerDay: 5,  minGapMinutes: 120 },
    linkedin:  { maxPerDay: 1,  minGapMinutes: 1440 },
  },
  maxPostsPerRun: 50,
  maxRetries: 3,
};

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (data) console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
  else console.log(`${prefix} ${message}`);
}

let supabase;
function initSupabase() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  if (!supabase) supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
}

async function lateApiRequest(method, path, body = null, profileId = null) {
  if (!CONFIG.lateApiKey) throw new Error('Missing LATE_API_KEY');
  const url = `${CONFIG.lateBaseUrl}${path}`;
  const headers = { 'Authorization': `Bearer ${CONFIG.lateApiKey}`, 'Content-Type': 'application/json' };
  if (profileId) headers['Profile-Key'] = profileId;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`getLate API error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.response = responseData;
    throw error;
  }
  return responseData;
}

async function getTodayPostCounts() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('scheduled_posts')
    .select('platform, account_id, account_handle, published_at')
    .eq('status', 'published')
    .gte('published_at', todayStart.toISOString());
  if (error) { log('error', 'Failed to get today post counts', error); return {}; }
  const counts = {};
  for (const post of (data || [])) {
    const key = `${post.platform}::${post.account_id}`;
    if (!counts[key]) counts[key] = { platform: post.platform, account_id: post.account_id, account_handle: post.account_handle, count: 0, lastPublished: null };
    counts[key].count++;
    const pubTime = new Date(post.published_at);
    if (!counts[key].lastPublished || pubTime > counts[key].lastPublished) counts[key].lastPublished = pubTime;
  }
  return counts;
}

function canPost(platform, accountId, todayCounts) {
  const limits = CONFIG.platformLimits[platform];
  if (!limits) return { allowed: true, reason: 'no limits configured' };
  const key = `${platform}::${accountId}`;
  const stats = todayCounts[key];
  if (stats && stats.count >= limits.maxPerDay)
    return { allowed: false, reason: `Daily limit reached: ${stats.count}/${limits.maxPerDay} for ${stats.account_handle || accountId} on ${platform}` };
  if (stats && stats.lastPublished) {
    const minSince = (Date.now() - stats.lastPublished.getTime()) / 60000;
    if (minSince < limits.minGapMinutes)
      return { allowed: false, reason: `Too soon: ${Math.round(minSince)}min since last, need ${limits.minGapMinutes}min for ${stats.account_handle || accountId} on ${platform}` };
  }
  return { allowed: true, reason: 'within limits' };
}

async function fetchDuePosts(limit = CONFIG.maxPostsPerRun) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('scheduled_posts').select('*')
    .eq('status', 'scheduled').lte('scheduled_at', now)
    .order('priority_score', { ascending: false })
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) { log('error', 'Failed to fetch due posts', error); return []; }
  return data || [];
}

function mapPlatformName(p) {
  const m = { tiktok:'tiktok', instagram:'instagram', youtube:'youtube', facebook:'facebook', twitter:'twitter', x:'twitter', threads:'threads', linkedin:'linkedin', pinterest:'pinterest' };
  return m[p?.toLowerCase()] || p;
}

function buildLatePayload(post) {
  const lateAccount = lookupLateAccount(post.platform, post.account_handle);
  if (!lateAccount) { log('warn', `No getLate mapping for ${post.platform}::${post.account_handle}`); return null; }
  const payload = {
    content: post.caption || '',
    platforms: [{ platform: mapPlatformName(post.platform), accountId: lateAccount.accountId }],
    publishNow: true,
  };
  if (post.media_url) {
    payload.mediaItems = [{ type: post.media_type || 'video', url: post.media_url }];
  }
  if (post.thumbnail_url && payload.mediaItems) {
    payload.mediaItems[0].thumbnail = { url: post.thumbnail_url };
  }
  if (post.title && ['youtube','linkedin'].includes(post.platform)) {
    payload.platforms[0].platformSpecificData = { title: post.title };
  }
  if (post.platform === 'youtube') {
    payload.platforms[0].platformSpecificData = {
      ...(payload.platforms[0].platformSpecificData || {}),
      visibility: 'public',
    };
  }
  return { payload, profileId: lateAccount.profileId };
}

async function publishPost(post, dryRun = false) {
  const built = buildLatePayload(post);
  if (!built) return { success: false, error: `No account mapping for ${post.platform}::${post.account_handle}` };
  const { payload, profileId } = built;

  if (dryRun) {
    log('info', `[DRY RUN] Would publish: ${post.platform} | ${post.account_handle} | lateAcct: ${payload.platforms[0].accountId}`);
    return { success: true, dryRun: true };
  }

  try {
    log('info', `Publishing ${post.id} to ${post.platform} (${post.account_handle})`);
    const result = await lateApiRequest('POST', '/posts', payload, profileId);
    const updateData = {
      status: 'published', published_at: new Date().toISOString(),
      late_job_id: result.post?._id || result._id || null, late_status: 'published',
      updated_at: new Date().toISOString(), error_message: null,
    };
    if (result.post?.platforms?.[0]?.platformPostUrl) {
      updateData.platform_post_url = result.post.platforms[0].platformPostUrl;
      updateData.platform_post_id = result.post.platforms[0].platformPostId || null;
    }
    await supabase.from('scheduled_posts').update(updateData).eq('id', post.id);
    log('info', `Published ${post.id} to ${post.platform} (${post.account_handle}) - Late ID: ${updateData.late_job_id}`);
    return { success: true, lateJobId: updateData.late_job_id };
  } catch (error) {
    log('error', `Failed ${post.id} on ${post.platform}`, { error: error.message, status: error.status, response: error.response });
    const retryCount = (post.retry_count || 0) + 1;
    const updateData = { retry_count: retryCount, error_message: error.message, last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString(), late_status: 'failed' };
    if (retryCount >= CONFIG.maxRetries) {
      updateData.status = 'failed';
      updateData.failure_category = 'publish_error';
      updateData.failure_details = JSON.stringify({ error: error.message, status: error.status, retries: retryCount });
      log('warn', `Post ${post.id} failed after ${retryCount} retries`);
    }
    await supabase.from('scheduled_posts').update(updateData).eq('id', post.id);
    return { success: false, error: error.message };
  }
}

async function runPublish(dryRun = false) {
  log('info', `=== TripSkip Publisher ${dryRun ? '(DRY RUN)' : ''} ===`);
  initSupabase();
  const todayCounts = await getTodayPostCounts();
  const duePosts = await fetchDuePosts();
  if (duePosts.length === 0) { log('info', 'No posts due. Queue empty.'); return { published: 0, skipped: 0, failed: 0, total: 0 }; }

  let published = 0, skipped = 0, failed = 0;
  const details = [];
  for (const post of duePosts) {
    const limitCheck = canPost(post.platform, post.account_id, todayCounts);
    if (!limitCheck.allowed) { log('info', `Skipping ${post.id}: ${limitCheck.reason}`); skipped++; continue; }
    if (post.media_url && !post.media_url.startsWith('http')) { log('warn', `Skipping ${post.id}: bad media URL`); skipped++; continue; }
    if (!post.caption && !post.media_url) { log('warn', `Skipping ${post.id}: no caption or media`); skipped++; continue; }

    const result = await publishPost(post, dryRun);
    if (result.success) {
      published++;
      details.push({ id: post.id, platform: post.platform, account: post.account_handle, status: 'published' });
      const key = `${post.platform}::${post.account_id}`;
      if (!todayCounts[key]) todayCounts[key] = { platform: post.platform, account_id: post.account_id, account_handle: post.account_handle, count: 0, lastPublished: null };
      todayCounts[key].count++;
      todayCounts[key].lastPublished = new Date();
    } else {
      failed++;
      details.push({ id: post.id, platform: post.platform, account: post.account_handle, status: 'failed', error: result.error });
    }
    if (!dryRun) await new Promise(r => setTimeout(r, 2000));
  }
  log('info', `=== Done === Published: ${published} | Skipped: ${skipped} | Failed: ${failed}`);
  return { published, skipped, failed, total: duePosts.length, details };
}

async function showStatus() {
  initSupabase();
  const statuses = {};
  for (const status of ['scheduled','published','failed']) {
    const { count } = await supabase.from('scheduled_posts').select('*', { count: 'exact', head: true }).eq('status', status);
    statuses[status] = count;
  }

  const todayCounts = await getTodayPostCounts();
  const todaySummary = {};
  for (const [key, stats] of Object.entries(todayCounts)) {
    const limit = CONFIG.platformLimits[stats.platform]?.maxPerDay || '?';
    todaySummary[`${stats.platform}|${stats.account_handle}`] = { posted: stats.count, limit };
  }

  const { data: upcoming } = await supabase.from('scheduled_posts').select('id, platform, account_handle, caption, scheduled_at')
    .eq('status', 'scheduled').order('scheduled_at', { ascending: true }).limit(10);
  const next10 = (upcoming || []).map(p => ({
    scheduledAt: p.scheduled_at, platform: p.platform, account: p.account_handle, caption: (p.caption||'').substring(0,80)
  }));

  return { queue: statuses, today: todaySummary, upcoming: next10 };
}

module.exports = { runPublish, showStatus };

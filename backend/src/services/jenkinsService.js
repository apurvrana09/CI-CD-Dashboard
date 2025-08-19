const axios = require('axios');

function ensureConfigured(override) {
  const baseURL = override?.baseURL;
  if (!baseURL) {
    throw new Error('Jenkins not configured');
  }
}

function jenkinsClient(override) {
  ensureConfigured(override);
  const baseURL = override.baseURL;
  const client = axios.create({ baseURL });
  const username = override?.username;
  const password = override?.password;
  if (username && password) {
    client.interceptors.request.use((config) => {
      config.auth = { username, password };
      return config;
    });
  }
  return client;
}

function normalizeJob(job, baseURL) {
  let url = job.url;
  try {
    if (baseURL && url) {
      const base = new URL(baseURL);
      const original = new URL(url);
      const combined = new URL(original.pathname + original.search + original.hash, base.origin + base.pathname);
      url = combined.toString();
    }
  } catch (_) {}
  return {
    name: job.name,
    url,
    color: job.color, // Jenkins color for status e.g. blue, red, notbuilt, disabled
  };
}

function normalizeBuild(build, baseURL) {
  let url = build.url;
  try {
    if (baseURL && url) {
      const base = new URL(baseURL);
      const original = new URL(url);
      const combined = new URL(original.pathname + original.search + original.hash, base.origin + base.pathname);
      url = combined.toString();
    }
  } catch (_) {}
  return {
    id: build.id,
    number: build.number,
    result: build.result, // SUCCESS, FAILURE, ABORTED, UNSTABLE, null if running
    building: build.building,
    timestamp: build.timestamp,
    duration: build.duration,
    url,
    fullDisplayName: build.fullDisplayName,
  };
}

function encodeJobPath(jobName) {
  // Jenkins uses /job/<name>/job/<child> for folders
  // jobName may come as 'Folder/Sub/jobName' or 'Folder/Child'
  if (!jobName) return '';
  const parts = jobName.split('/').filter(Boolean);
  return parts.map(p => `job/${encodeURIComponent(p)}`).join('/');
}

async function listJobsAt(path = '', override) {
  const client = jenkinsClient(override);
  const url = `${path ? '/' + path : ''}/api/json?tree=jobs[name,url,color,_class]`;
  const { data } = await client.get(url);
  return data.jobs || [];
}

async function flattenJobs(basePath = '', prefix = '', override) {
  const items = await listJobsAt(basePath, override);
  const jobs = [];
  for (const j of items) {
    const isFolder = j._class && j._class.includes('Folder');
    const displayName = prefix ? `${prefix}/${j.name}` : j.name;
    if (isFolder) {
      const folderPath = `${basePath ? basePath + '/' : ''}job/${encodeURIComponent(j.name)}`;
      const nested = await flattenJobs(folderPath, displayName, override);
      jobs.push(...nested);
    } else {
      jobs.push(normalizeJob({ name: displayName, url: j.url, color: j.color }, override?.baseURL));
    }
  }
  return jobs;
}

async function getJobs(override) {
  ensureConfigured(override);
  const baseURL = override.baseURL;
  // Recursively flatten folders into names like 'Folder/Sub/Job'
  return await flattenJobs('', '', override);
}

async function getJobBuilds(jobName, limit = 20, override) {
  ensureConfigured(override);
  const baseURL = override.baseURL;
  const client = jenkinsClient(override);
  const jobPath = encodeJobPath(jobName);
  const path = `/${jobPath}/api/json?tree=builds[number,url,result,building,timestamp,duration,fullDisplayName]{,${limit}}`;
  const { data } = await client.get(path);
  return (data.builds || []).slice(0, limit).map(b => normalizeBuild(b, baseURL));
}

async function getLastBuild(jobName, override) {
  ensureConfigured(override);
  const baseURL = override.baseURL;
  const client = jenkinsClient(override);
  const jobPath = encodeJobPath(jobName);
  const { data } = await client.get(`/${jobPath}/lastBuild/api/json`);
  return normalizeBuild(data, baseURL);
}

async function getJobInfo(jobName, override) {
  ensureConfigured(override);
  const baseURL = override.baseURL;
  const client = jenkinsClient(override);
  const jobPath = encodeJobPath(jobName);
  const { data } = await client.get(`/${jobPath}/api/json?tree=name,url,color,description,displayName,lastBuild[number,url],lastCompletedBuild[number,url],lastSuccessfulBuild[number,url],lastFailedBuild[number,url]`);
  const info = {
    name: data.name,
    displayName: data.displayName,
    description: data.description,
    color: data.color,
    url: data.url,
    lastBuild: data.lastBuild || null,
    lastCompletedBuild: data.lastCompletedBuild || null,
    lastSuccessfulBuild: data.lastSuccessfulBuild || null,
    lastFailedBuild: data.lastFailedBuild || null,
  };
  // rewrite URL to configured base (origin + base path), preserve job path/query/hash
  try {
    if (baseURL && info.url) {
      const base = new URL(baseURL);
      const original = new URL(info.url);
      const combined = new URL(original.pathname + original.search + original.hash, base.origin + base.pathname);
      info.url = combined.toString();
    }
  } catch (_) {}
  return info;
}

async function getBuildLog(jobName, buildNumber, override) {
  ensureConfigured(override);
  const client = jenkinsClient(override);
  const jobPath = encodeJobPath(jobName);
  // Jenkins console output
  const path = `/${jobPath}/${encodeURIComponent(buildNumber)}/consoleText`;
  const { data } = await client.get(path, { responseType: 'text' });
  return String(data || '');
}

module.exports = {
  getJobs,
  getJobBuilds,
  getLastBuild,
  getJobInfo,
  getBuildLog,
};

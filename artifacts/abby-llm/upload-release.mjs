#!/usr/bin/env node
/**
 * Загружает собранный установщик (.exe + .blockmap) в GitHub Release.
 * Запускается из artifacts/abby-llm/ после dist:win.
 * Требует GH_TOKEN в окружении.
 */
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const token = process.env.GH_TOKEN;
if (!token) { console.error('GH_TOKEN не задан'); process.exit(1); }

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const version = pkg.version;
const owner = 'Abbydynamics';
const repo = 'abby-llm';
const tagName = `v${version}`;

async function apiFetch(urlOrPath, opts = {}) {
  const url = urlOrPath.startsWith('https://') ? urlOrPath
    : `https://api.github.com/repos/${owner}/${repo}${urlOrPath}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'abby-upload-script',
      Accept: 'application/vnd.github+json',
      ...(opts.headers || {})
    }
  });
  return res;
}

async function getOrCreateRelease() {
  const res = await apiFetch(`/releases/tags/${tagName}`);
  if (res.ok) {
    const rel = await res.json();
    console.log(`Релиз ${tagName} найден (id=${rel.id}), ассеты: ${rel.assets.map(a => a.name).join(', ') || 'нет'}`);
    // Удаляем ВСЕ старые ассеты (может быть bitый или дублирующийся)
    for (const asset of rel.assets) {
      console.log(`Удаляю старый ассет: ${asset.name}`);
      await apiFetch(`/releases/assets/${asset.id}`, { method: 'DELETE' });
    }
    return rel.id;
  }
  // Создаём новый релиз
  console.log(`Создаю новый релиз ${tagName}...`);
  const createRes = await apiFetch('/releases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tagName,
      name: `Abby LLM ${version}`,
      body: `Abby LLM ${version}`,
      draft: false,
      prerelease: false
    })
  });
  const rel = await createRes.json();
  console.log(`Релиз создан (id=${rel.id})`);
  return rel.id;
}

function uploadFile(releaseId, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(filePath).size;
    console.log(`Загружаю ${fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)...`);
    const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;
    const urlObj = new URL(uploadUrl);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'abby-upload-script',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileSize
      }
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 201) {
          const data = JSON.parse(body);
          console.log(`✓ Загружено: ${data.browser_download_url}`);
          resolve(data);
        } else {
          reject(new Error(`Upload failed: HTTP ${res.statusCode} — ${body.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    const stream = fs.createReadStream(filePath);
    stream.pipe(req);
  });
}

const exeName = `Abby-LLM-Setup-${version}.exe`;
const exePath = path.join(__dirname, 'release', exeName);
const blockmapPath = exePath + '.blockmap';

if (!fs.existsSync(exePath)) {
  console.error(`Файл не найден: ${exePath}`);
  process.exit(1);
}

const releaseId = await getOrCreateRelease();
await uploadFile(releaseId, blockmapPath, exeName + '.blockmap');
await uploadFile(releaseId, exePath, exeName);
console.log('\nГотово! Релиз обновлён.');

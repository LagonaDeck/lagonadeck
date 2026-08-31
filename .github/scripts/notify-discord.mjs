import { readFile } from 'node:fs/promises';

const maxFieldLength = 1_000;
const maxErrorLength = 1_500;

function truncate(value, limit = maxFieldLength) {
  const text = String(value ?? '').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function escapeMentions(value) {
  return String(value ?? '').replace(/@(everyone|here)/gi, '@\u200b$1');
}

function issuesFromPullRequest(pr) {
  const references = `${pr.title ?? ''}\n${pr.body ?? ''}`;
  const pattern = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\s+#(\d+)\b/gi;
  return [
    ...new Set([...references.matchAll(pattern)].map((match) => match[1])),
  ];
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function commitFor({ apiUrl, repository, sha, token }) {
  if (!sha || !token) return null;
  try {
    const response = await fetch(
      `${apiUrl}/repos/${repository}/commits/${sha}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    return response.ok ? response.json() : null;
  } catch (error) {
    console.warn(`Unable to retrieve commit metadata: ${error.message}`);
    return null;
  }
}

async function commitsForPullRequest({ apiUrl, repository, number, token }) {
  if (!number || !token) return [];
  const commits = [];
  for (let page = 1; page <= 100; page += 1) {
    try {
      const response = await fetch(
        `${apiUrl}/repos/${repository}/pulls/${number}/commits?per_page=100&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) return commits;
      const pageCommits = await response.json();
      if (!Array.isArray(pageCommits) || pageCommits.length === 0) break;
      commits.push(...pageCommits);
      if (pageCommits.length < 100) break;
    } catch (error) {
      console.warn(`Unable to retrieve pull request commits: ${error.message}`);
      break;
    }
  }
  return commits;
}

function commitListFields(commits) {
  const lines = commits.map((item) => {
    const itemSha = item.sha || '';
    const message = truncate(
      escapeMentions(
        item.commit?.message?.split('\n')[0] || 'Message indisponible',
      ),
      180,
    );
    const label = `\`${itemSha.slice(0, 7)}\` - ${message}`;
    return item.html_url ? `[${label}](${item.html_url})` : label;
  });
  const chunks = [];
  let chunk = '';
  for (const line of lines) {
    if (chunk && `${chunk}\n${line}`.length > 950) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk = chunk ? `${chunk}\n${line}` : line;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((value, index) => ({
    name:
      index === 0
        ? `📚 Commits de la PR (${commits.length})`
        : '📚 Commits de la PR (suite)',
    value,
    inline: false,
  }));
}

async function errorExcerpt(logPath) {
  if (!logPath) return 'Le journal de l’étape est indisponible.';
  try {
    const log = await readFile(logPath, 'utf8');
    const lines = log
      .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
      .trim()
      .split('\n');
    return (
      truncate(lines.slice(-25).join('\n'), maxErrorLength) ||
      'Aucun détail exploitable dans le journal.'
    );
  } catch {
    return 'Le journal de l’étape est indisponible.';
  }
}

const event = await readJson(process.env.GITHUB_EVENT_PATH, {});
const webhook = process.env.DISCORD_CICD_WEBHOOK;

if (!webhook) {
  console.log(
    'DISCORD_CICD_WEBHOOK is not configured; Discord notification skipped.',
  );
  process.exit(0);
}

const checks = [
  {
    name: 'Prettier',
    result: process.env.PRETTIER_RESULT,
    log: process.env.PRETTIER_LOG,
  },
  { name: 'Lint', result: process.env.LINT_RESULT, log: process.env.LINT_LOG },
  {
    name: 'Unit Tests',
    result: process.env.TEST_RESULT,
    log: process.env.TEST_LOG,
  },
];
const normalise = (result) => (result || 'unknown').toLowerCase();
const failedCheck = checks.find(
  (check) => normalise(check.result) === 'failure',
);
const cancelled = checks.some(
  (check) => normalise(check.result) === 'cancelled',
);
const succeeded = checks.every(
  (check) => normalise(check.result) === 'success',
);
const status = succeeded
  ? 'success'
  : cancelled && !failedCheck
    ? 'cancelled'
    : 'failure';
const presentation = {
  success: { title: '✅ CI LagonaDeck réussie', color: 0x57f287 },
  failure: { title: '❌ CI LagonaDeck échouée', color: 0xed4245 },
  cancelled: { title: '⚠️ CI LagonaDeck annulée', color: 0xfee75c },
}[status];

const pr = event.pull_request;
const sha = pr?.head?.sha || process.env.GITHUB_SHA;
const pullRequestCommits = pr
  ? await commitsForPullRequest({
      apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
      repository: process.env.GITHUB_REPOSITORY,
      number: pr.number,
      token: process.env.GITHUB_TOKEN,
    })
  : [];
const commit = await commitFor({
  apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  repository: process.env.GITHUB_REPOSITORY,
  sha,
  token: process.env.GITHUB_TOKEN,
});
const githubLogin =
  commit?.author?.login ||
  pr?.user?.login ||
  process.env.GITHUB_ACTOR ||
  'inconnu';
const discordUsers = await readJson('.github/discord-users.json', {});
const discordId = discordUsers[githubLogin];
const author =
  typeof discordId === 'string' && /^\d{5,25}$/.test(discordId)
    ? `<@${discordId}> (${githubLogin})`
    : githubLogin;
const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
const runUrl = `${serverUrl}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const commitMessage = truncate(
  escapeMentions(
    commit?.commit?.message?.split('\n')[0] ||
      event.head_commit?.message ||
      'Message indisponible',
  ),
  900,
);
const commitValue = sha
  ? `[\`${sha.slice(0, 7)}\` - ${commitMessage}](${serverUrl}/${process.env.GITHUB_REPOSITORY}/commit/${sha})`
  : commitMessage;

const fields = [{ name: '👤 Auteur', value: author, inline: true }];
if (pr) {
  fields.push(
    {
      name: '🔀 Pull Request',
      value: `[#${pr.number} - ${escapeMentions(truncate(pr.title, 900))}](${pr.html_url})`,
      inline: false,
    },
    {
      name: '🌿 Branches',
      value: `${escapeMentions(pr.head.ref)} → ${escapeMentions(pr.base.ref)}`,
      inline: false,
    },
  );
  const issues = issuesFromPullRequest(pr);
  if (issues.length) {
    fields.push({
      name: '🎫 Issues',
      value: issues
        .map(
          (number) =>
            `[#${number}](${serverUrl}/${process.env.GITHUB_REPOSITORY}/issues/${number})`,
        )
        .join(', '),
      inline: false,
    });
  }
} else if (event.ref) {
  fields.push({
    name: '🌿 Branche',
    value: escapeMentions(event.ref.replace('refs/heads/', '')),
    inline: true,
  });
}
fields.push({ name: '📝 Commit', value: commitValue, inline: false });
if (pullRequestCommits.length)
  fields.push(...commitListFields(pullRequestCommits));

if (status === 'failure') {
  fields.push(
    {
      name: '💥 Étape échouée',
      value: failedCheck?.name || 'Étape inconnue',
      inline: false,
    },
    {
      name: '🔍 Erreur',
      value: `\`\`\`\n${await errorExcerpt(failedCheck?.log)}\n\`\`\``,
      inline: false,
    },
  );
} else {
  fields.push({
    name: status === 'success' ? '✅ Résultat' : '⚠️ Résultat',
    value: checks
      .map(
        (check) =>
          `${check.name}: ${normalise(check.result) === 'success' ? '✅' : normalise(check.result)}`,
      )
      .join('\n'),
    inline: false,
  });
}

const links = [
  pr ? `[Voir la Pull Request](${pr.html_url})` : null,
  `[Voir l’exécution GitHub Actions](${runUrl})`,
]
  .filter(Boolean)
  .join(' • ');
const payload = {
  allowed_mentions: { parse: [], users: discordId ? [discordId] : [] },
  embeds: [
    {
      title: presentation.title,
      color: presentation.color,
      fields,
      description: links,
      timestamp: new Date().toISOString(),
    },
  ],
};

try {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    console.error(`Discord notification failed with HTTP ${response.status}.`);
} catch (error) {
  console.error(`Discord notification failed: ${error.message}`);
}

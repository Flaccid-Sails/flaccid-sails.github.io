import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./save-talents.sh', import.meta.url));
const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
};
const run = (cwd, command, args) => execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: 'pipe' }).trim();
const git = (cwd, ...args) => run(cwd, 'git', args);

async function fixture(t) {
    const dir = await mkdtemp(join(tmpdir(), 'flaccid-save-talents-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const remote = join(dir, 'remote.git');
    const checkout = join(dir, 'checkout');
    git(dir, 'init', '--bare', '--initial-branch=main', remote);
    git(dir, 'clone', remote, checkout);
    await mkdir(join(checkout, 'data'));
    await mkdir(join(checkout, 'site/public/icons'), { recursive: true });
    await writeFile(join(checkout, 'README.md'), 'Original source\n');
    await writeFile(join(checkout, 'data/talents.json'), '{"checkedAt":"old"}\n');
    await writeFile(join(checkout, 'site/public/icons/existing.webp'), 'Existing icon');
    git(checkout, 'add', '.');
    git(checkout, 'commit', '-m', 'Initial source');
    git(checkout, 'push', 'origin', 'main');
    return { dir, remote, checkout };
}

test('talent commit updates main while preserving source files and unrelated staged changes', async t => {
    const { remote, checkout } = await fixture(t);
    const parent = git(checkout, 'rev-parse', 'HEAD');
    await writeFile(join(checkout, 'data/talents.json'), '{"checkedAt":"new"}\n');
    await writeFile(join(checkout, 'site/public/icons/new.webp'), 'New icon');
    await writeFile(join(checkout, 'site/public/icons/private.txt'), 'Do not publish');
    await writeFile(join(checkout, 'README.md'), 'Unrelated staged change\n');
    git(checkout, 'add', 'README.md', 'site/public/icons/private.txt');
    const status = git(checkout, 'status', '--porcelain');

    run(checkout, 'bash', [script]);

    assert.equal(git(remote, 'rev-parse', 'main^'), parent);
    assert.equal(git(remote, 'show', 'main:data/talents.json'), '{"checkedAt":"new"}');
    assert.equal(git(remote, 'show', 'main:README.md'), 'Original source');
    assert.equal(git(remote, 'show', 'main:site/public/icons/existing.webp'), 'Existing icon');
    assert.equal(git(remote, 'show', 'main:site/public/icons/new.webp'), 'New icon');
    assert.deepEqual(git(remote, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'main').split('\n'), [
        'data/talents.json', 'site/public/icons/new.webp',
    ]);
    assert.equal(git(remote, 'branch', '--format=%(refname:short)'), 'main');
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), parent);
    assert.equal(git(checkout, 'status', '--porcelain'), status);
});

test('unchanged generated files do not create a commit', async t => {
    const { remote, checkout } = await fixture(t);
    const parent = git(remote, 'rev-parse', 'main');
    assert.match(run(checkout, 'bash', [script]), /already up to date/);
    assert.equal(git(remote, 'rev-parse', 'main'), parent);
});

test('a concurrent main commit is preserved and the stale data push fails', async t => {
    const { dir, remote, checkout } = await fixture(t);
    const other = join(dir, 'other');
    git(dir, 'clone', remote, other);
    await writeFile(join(other, 'README.md'), 'New source commit\n');
    git(other, 'add', 'README.md');
    git(other, 'commit', '-m', 'Concurrent source change');
    git(other, 'push', 'origin', 'main');
    const newer = git(remote, 'rev-parse', 'main');
    await writeFile(join(checkout, 'data/talents.json'), '{"checkedAt":"new"}\n');

    assert.throws(() => run(checkout, 'bash', [script]), error => {
        assert.match(error.stderr, /rejected/);
        return true;
    });
    assert.equal(git(remote, 'rev-parse', 'main'), newer);
    assert.equal(git(remote, 'show', 'main:README.md'), 'New source commit');
    assert.equal(git(remote, 'show', 'main:data/talents.json'), '{"checkedAt":"old"}');
});

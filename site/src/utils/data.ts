import { Snapshot } from '@src/models/Snapshot';
import { ReportIndexEntry } from '@src/models/ReportIndexEntry';
import { ReportDTO } from '@src/models/ReportDTO';
import { DashboardBossDTO } from '@src/models/DashboardBossDTO';
import { TalentCatalog } from '@src/models/Talents';

let snapshot: Promise<Snapshot> | undefined;
const files = new Map<string, Promise<unknown>>();
const hashedFile = /^(?:characters|reports|indexes|catalog)\/[a-f0-9]{64}\.json$/;

async function json<T>(path: string, immutable = false): Promise<T> {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { cache: immutable ? 'force-cache' : 'no-cache' });
    if (!response.ok) throw new Error(`Unable to load guild data (${response.status})`);
    return response.json();
}

function readFile<T>(filename: string): Promise<T> {
    if (!hashedFile.test(filename)) throw new Error('Invalid guild data file');
    if (!files.has(filename)) {
        files.set(filename, json<T>(filename, true).catch(error => {
            files.delete(filename);
            throw error;
        }));
    }
    return files.get(filename)! as Promise<T>;
}

export function loadSnapshot(refresh = false): Promise<Snapshot> {
    if (!snapshot || refresh) {
        const previous = snapshot;
        const pending = json<Snapshot>('snapshot.json').then(data => {
            if (data.schemaVersion !== 2 || !Array.isArray(data.players) ||
                !hashedFile.test(data.characterIndexFile) || !hashedFile.test(data.reportIndexFile) ||
                !hashedFile.test(data.dashboardFile) || !hashedFile.test(data.talentCatalogFile))
                throw new Error('Unsupported guild data snapshot');
            return data;
        }).catch(error => {
            if (snapshot === pending) snapshot = previous;
            throw error;
        });
        snapshot = pending;
    }
    return snapshot;
}

async function fromSnapshot<T>(data: Snapshot | undefined, filename: (current: Snapshot) => string): Promise<T> {
    const current = data ?? await loadSnapshot();
    const previousFile = filename(current);
    try {
        return await readFile<T>(previousFile);
    } catch (error) {
        const latest = await loadSnapshot(true);
        const latestFile = filename(latest);
        if (latestFile === previousFile) throw error;
        return readFile<T>(latestFile);
    }
}

export async function loadReportIndex(data?: Snapshot): Promise<ReportIndexEntry[]> {
    return fromSnapshot(data, current => current.reportIndexFile);
}

export async function loadDashboard(data?: Snapshot): Promise<DashboardBossDTO[]> {
    return fromSnapshot(data, current => current.dashboardFile);
}

export async function loadTalentCatalog(data?: Snapshot): Promise<TalentCatalog> {
    return fromSnapshot(data, current => current.talentCatalogFile);
}

export async function loadReport(report: ReportIndexEntry): Promise<ReportDTO> {
    try {
        return await readFile<ReportDTO>(report.file);
    } catch (error) {
        const latest = await loadSnapshot(true);
        const index = await readFile<ReportIndexEntry[]>(latest.reportIndexFile);
        const replacement = index.find(entry => entry.code === report.code);
        if (!replacement || replacement.file === report.file) throw error;
        return readFile<ReportDTO>(replacement.file);
    }
}

export async function readData<T>(url: string): Promise<T> {
    const [, section, realm, name] = url.split('/');
    if (!realm || !name) throw new Error('Character details are unavailable');
    async function sectionFrom(data: Snapshot): Promise<T> {
        const index = await readFile<Record<string, string>>(data.characterIndexFile);
        const filename = index[`${realm}/${name}`];
        if (!filename || !/^characters\/[a-f0-9]{64}\.json$/.test(filename))
            throw new Error('Character details are unavailable');
        const profile = await readFile<Record<string, unknown>>(filename);
        if (!(section in profile)) throw new Error('Character details are unavailable');
        return profile[section] as T;
    }
    const current = await loadSnapshot();
    try {
        return await sectionFrom(current);
    } catch (error) {
        const latest = await loadSnapshot(true);
        if (latest.characterIndexFile === current.characterIndexFile) throw error;
        return sectionFrom(latest);
    }
}

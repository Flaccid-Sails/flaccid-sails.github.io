export function planCharacterRefresh(roster, cache, policy, now = Date.now()) {
    const hours = 3_600_000;
    return roster.filter(player => {
        if (player.level !== policy.detailedLevel) return false;
        const saved = cache[`${player.realm}/${player.name}`];
        if (!saved) return true;
        const inactive = saved.lastLogin < now - policy.inactiveAfterDays * 24 * hours;
        const ttl = inactive ? policy.inactiveRefreshHours : policy.detailsRefreshHours;
        return now - saved.fetchedAt >= ttl * hours;
    }).sort((a, b) => {
        const aTime = cache[`${a.realm}/${a.name}`]?.fetchedAt ?? 0;
        const bTime = cache[`${b.realm}/${b.name}`]?.fetchedAt ?? 0;
        return aTime - bTime || a.name.localeCompare(b.name);
    }).slice(0, policy.maxCharactersPerRun);
}

export function planReportRefresh(reports, cache, policy) {
    return reports.filter(report => !cache[report.code] || cache[report.code].endTime !== report.endTime)
        .sort((a, b) => b.endTime - a.endTime)
        .slice(0, policy.maxReportsPerRun);
}

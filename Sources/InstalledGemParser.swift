import Foundation

struct InstalledGem: Identifiable, Equatable {
    let id: String
    let name: String
    let version: String
}

enum InstalledGemParser {
    static func parse(_ output: String) -> [InstalledGem] {
        output.components(separatedBy: .newlines).compactMap(parseLine)
    }

    static func resolveVersion(reported: String?, installed: String?) -> String? {
        usableVersion(reported) ?? usableVersion(installed)
    }

    private static func parseLine(_ line: String) -> InstalledGem? {
        let line = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard line.hasPrefix("lex-"), line.hasSuffix(")"),
              let versionStart = line.range(of: " (") else { return nil }

        let name = String(line[..<versionStart.lowerBound])
        let versionsEnd = line.index(before: line.endIndex)
        let versions = line[versionStart.upperBound..<versionsEnd]
        guard let firstVersion = versions.split(separator: ",", maxSplits: 1, omittingEmptySubsequences: false).first,
              let version = usableVersion(String(firstVersion)),
              !version.contains("("), !version.contains(")") else { return nil }

        return InstalledGem(id: name, name: name, version: version)
    }

    private static func usableVersion(_ version: String?) -> String? {
        guard let version = version?.trimmingCharacters(in: .whitespacesAndNewlines),
              !version.isEmpty, version != "-", version != "—" else { return nil }
        return version
    }
}

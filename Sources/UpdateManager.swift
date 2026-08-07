import Foundation
import SwiftUI
@preconcurrency import UserNotifications

struct UpdateItem: Identifiable {
    enum Source: String {
        case gem = "gem"
        case cask = "cask"
    }

    let id: String
    let name: String
    let currentVersion: String
    let availableVersion: String
    let source: Source
    var isUpdating: Bool = false

    var isLex: Bool { name.hasPrefix("lex-") }
    var isCoreLibrary: Bool { name.hasPrefix("legion-") || name == "legionio" || name == "legion-interlink" }
    var isLegionio: Bool { name == "legionio" }
    var isInterlink: Bool { name == "legion-interlink" }
}

@MainActor
class UpdateManager: ObservableObject {
    static let shared = UpdateManager()

    @Published var items: [UpdateItem] = []
    @Published var isChecking = false
    @Published var hasChecked = false
    @Published var lastChecked: Date?
    @Published var checkError: String?
    @Published var autoUpdateGems: Bool {
        didSet { persistPreferences() }
    }
    @Published var autoUpgradeLegionio: Bool {
        didSet { persistPreferences() }
    }
    @Published var restartAfterUpdate: Bool {
        didSet { persistPreferences() }
    }
    @Published private(set) var isRunningUpdateCycle = false

    private let resolvedBrewPath: String
    private let resolvedLegionGemPath: String
    private let resolvedLegionioPath: String
    private var backgroundTimer: Timer?
    private var diskVersionTimer: Timer?

    private init() {
        let preferences = UpdatePreferences.load()
        autoUpdateGems = preferences.autoUpdateGems
        autoUpgradeLegionio = preferences.autoUpgradeCLI
        restartAfterUpdate = preferences.restartDaemon
        resolvedBrewPath = Self.findPath("/opt/homebrew/bin/brew", fallback: "/usr/local/bin/brew")
        resolvedLegionGemPath = Self.findPath("/opt/homebrew/bin/legion-gem", fallback: "/usr/local/bin/legion-gem")
        resolvedLegionioPath = Self.findPath("/opt/homebrew/bin/legionio", fallback: "/usr/local/bin/legionio")
        startBackgroundChecks()
    }

    static func findPath(_ primary: String, fallback: String) -> String {
        FileManager.default.isExecutableFile(atPath: primary) ? primary : fallback
    }

    var outdatedCount: Int {
        items.count
    }

    var anyUpdating: Bool {
        isRunningUpdateCycle || items.contains { $0.isUpdating }
    }

    // MARK: - Notifications

    private nonisolated func sendNotification(title: String, body: String) {
        // UNUserNotificationCenter requires a proper .app bundle with a bundle ID.
        // Plain binary dev builds have no bundle — skip silently to avoid a hard crash.
        guard Bundle.main.bundleIdentifier != nil else { return }

        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        // Persistent notification — user must dismiss it explicitly.
        #if compiler(>=6.0)
            if #available(macOS 15.0, *) {
                content.interruptionLevel = .timeSensitive
            }
        #endif

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Background Periodic Check

    private func startBackgroundChecks() {
        backgroundTimer = Timer.scheduledTimer(withTimeInterval: 14400, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                await self.checkForUpdates(force: true, background: true)
            }
        }

        // Every 5 minutes, check if `brew upgrade legion-interlink` replaced the binary on disk
        diskVersionTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.checkDiskVersionAndRelaunch()
        }
    }

    /// Detects when an external `brew upgrade legion-interlink` replaced the binary on disk.
    /// Shows a notification and relaunches the app automatically.
    private nonisolated func checkDiskVersionAndRelaunch() {
        let runningVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        let diskVersion = Self.diskVersion()
        guard !runningVersion.isEmpty, !diskVersion.isEmpty,
              diskVersion != runningVersion else { return }

        // Only relaunch once per version bump to avoid loops
        let key = "InterlinkLastRelaunchVersion"
        let lastNotified = UserDefaults.standard.string(forKey: key) ?? ""
        guard lastNotified != diskVersion else { return }
        UserDefaults.standard.set(diskVersion, forKey: key)

        let content = UNMutableNotificationContent()
        content.title = "Legion Interlink"
        content.body = "Updated to \(diskVersion). Restarting..."
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: "disk-upgrade-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let bundlePath = Bundle.main.bundlePath
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/sh")
            process.arguments = ["-c", "sleep 3 && open '\(bundlePath)'"]
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice
            try? process.run()
            NSApplication.shared.terminate(nil)
        }
    }

    // MARK: - Check for Updates

    func checkForUpdates(force: Bool = false, background: Bool = false) async {
        guard !isChecking else { return }
        guard force || !hasChecked else { return }

        isChecking = true
        checkError = nil

        let legionGem = resolvedLegionGemPath
        async let gemItems = Self.checkGemOutdated(legionGem: legionGem)
        async let caskItem = Self.checkCaskOutdated()

        let allItems = await Array(gemItems) + (caskItem.map { [$0] } ?? [])

        let previousCount = items.count
        items = allItems
        hasChecked = true
        lastChecked = Date()
        isChecking = false

        if !items.isEmpty && items.count > previousCount {
            let legionioCount = allItems.filter(\.isLegionio).count
            let interlinkCount = allItems.filter(\.isInterlink).count
            let coreCount = allItems.filter { $0.isCoreLibrary && !$0.isLegionio && !$0.isInterlink }.count

            if legionioCount > 0 {
                sendNotification(
                    title: "LegionIO Update Available",
                    body: "A new version of legionio is available."
                )
            }
            if interlinkCount > 0 {
                sendNotification(
                    title: "Legion Interlink Update Available",
                    body: "A new version of Legion Interlink is available. Restart required."
                )
            }
            if coreCount > 0 {
                sendNotification(
                    title: "Legion Core Libraries Outdated",
                    body: "\(coreCount) core librar\(coreCount == 1 ? "y has" : "ies have") updates available."
                )
            }
        }

        runAutomaticUpdateCycle()
    }

    // MARK: - Update Actions

    func updateItem(_ item: UpdateItem) {
        if item.isInterlink {
            runUpdateCycle(UpdateExecutionPlan(gemIDs: [], cliID: nil, interlinkID: item.id))
        } else if item.isLegionio {
            runUpdateCycle(UpdateExecutionPlan(gemIDs: [], cliID: item.id, interlinkID: nil))
        } else {
            runUpdateCycle(UpdateExecutionPlan(gemIDs: pendingGemIDs, cliID: nil, interlinkID: nil))
        }
    }

    func updateAll() {
        runUpdateCycle(
            UpdateExecutionPlan(
                gemIDs: pendingGemIDs,
                cliID: items.first(where: \.isLegionio)?.id,
                interlinkID: items.first(where: \.isInterlink)?.id
            )
        )
    }

    private var pendingGemIDs: [String] {
        items.filter { $0.source == .gem && !$0.isLegionio }.map(\.id)
    }

    private func runAutomaticUpdateCycle() {
        let plan = UpdateExecutionPlan.automatic(
            gemIDs: pendingGemIDs,
            cliID: items.first(where: \.isLegionio)?.id,
            autoUpdateGems: autoUpdateGems,
            autoUpgradeCLI: autoUpgradeLegionio
        )
        runUpdateCycle(plan)
    }

    /// Runs CLI, gem, and Interlink updates in order. The daemon restarts at most once.
    private func runUpdateCycle(_ plan: UpdateExecutionPlan) {
        guard plan.hasWork, !isRunningUpdateCycle else { return }
        isRunningUpdateCycle = true

        let plannedIDs = Set(plan.gemIDs + [plan.cliID, plan.interlinkID].compactMap { $0 })
        for index in items.indices where plannedIDs.contains(items[index].id) {
            items[index].isUpdating = true
        }

        let brew = resolvedBrewPath
        let legionio = resolvedLegionioPath
        let shouldRestart = restartAfterUpdate

        Task.detached {
            let cliSucceeded = plan.cliID.map { _ in
                Self.runSync(brew, arguments: ["upgrade", "legionio"])
            }
            let gemsSucceeded = plan.gemIDs.isEmpty ? nil : Self.runSync(legionio, arguments: ["update"])

            let restartSucceeded: Bool
            if shouldRestart && (cliSucceeded == true || gemsSucceeded == true) {
                restartSucceeded = await ServiceManager.shared.restartServiceAndWait(.legionio)
            } else {
                restartSucceeded = true
            }

            let interlinkSucceeded = restartSucceeded ? plan.interlinkID.map { _ in
                Self.runSync(brew, arguments: ["upgrade", "legion-interlink"])
            } : nil

            await MainActor.run {
                var successfulIDs = Set<String>()
                if cliSucceeded == true, let cliID = plan.cliID {
                    successfulIDs.insert(cliID)
                }
                if gemsSucceeded == true {
                    successfulIDs.formUnion(plan.gemIDs)
                }
                if interlinkSucceeded == true, let interlinkID = plan.interlinkID {
                    successfulIDs.insert(interlinkID)
                }

                self.items.removeAll { successfulIDs.contains($0.id) }
                for index in self.items.indices where plannedIDs.contains(self.items[index].id) {
                    self.items[index].isUpdating = false
                }
                if !restartSucceeded {
                    self.checkError = "Updates installed, but the LegionIO daemon failed to restart."
                }
                self.isRunningUpdateCycle = false
            }

            if interlinkSucceeded == true {
                Self.relaunchInterlink()
            }
        }
    }

    private func persistPreferences() {
        UpdatePreferences(
            autoUpdateGems: autoUpdateGems,
            autoUpgradeCLI: autoUpgradeLegionio,
            restartDaemon: restartAfterUpdate
        ).persist()
    }

    private nonisolated static func relaunchInterlink() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let bundlePath = Bundle.main.bundlePath
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/sh")
            process.arguments = ["-c", "sleep 3 && open '\(bundlePath)'"]
            process.standardOutput = FileHandle.nullDevice
            process.standardError = FileHandle.nullDevice
            try? process.run()
            NSApplication.shared.terminate(nil)
        }
    }

    // MARK: - Cask Version Check (GitHub API)

    /// Fetch the latest release tag from the Legion Interlink GitHub releases page.
    /// Returns an UpdateItem if the running version is older than the latest release.
    private nonisolated static func checkCaskOutdated() async -> UpdateItem? {
        let url = URL(string: "https://api.github.com/repos/LegionIO/legion-interlink/releases/latest")!
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return nil
            }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let tagName = json["tag_name"] as? String else {
                return nil
            }
            // tag_name is like "v2.3.2"
            let latestVersion = String(tagName.drop(while: { $0 == "v" }))

            let runningVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
            guard !runningVersion.isEmpty, latestVersion != runningVersion else {
                return nil
            }

            // Only report if newer (numeric comparison handles semver well enough)
            if latestVersion.compare(runningVersion, options: .numeric) == .orderedDescending {
                return UpdateItem(
                    id: "cask:legion-interlink",
                    name: "legion-interlink",
                    currentVersion: runningVersion,
                    availableVersion: latestVersion,
                    source: .cask
                )
            }
        } catch {
            // Network error or GitHub rate-limited — silently skip
        }
        return nil
    }

    // MARK: - Gem Parsing

    private nonisolated static func checkGemOutdated(legionGem: String) async -> [UpdateItem] {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: legionGem)
        process.arguments = ["outdated"]
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return []
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let output = String(data: data, encoding: .utf8) else { return [] }

        return output
            .components(separatedBy: "\n")
            .filter { $0.contains("legion") || $0.contains("lex") }
            .compactMap { parseGemLine($0) }
    }

    /// Parses lines like: `legion-apollo (0.5.5 < 0.5.6)`
    private nonisolated static func parseGemLine(_ line: String) -> UpdateItem? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }

        guard let parenStart = trimmed.firstIndex(of: "("),
              let parenEnd = trimmed.firstIndex(of: ")") else { return nil }

        let name = String(trimmed[trimmed.startIndex..<parenStart]).trimmingCharacters(in: .whitespaces)
        let versionPart = String(trimmed[trimmed.index(after: parenStart)..<parenEnd])
        let parts = versionPart.components(separatedBy: " < ")

        guard parts.count == 2 else { return nil }
        let current = parts[0].trimmingCharacters(in: .whitespaces)
        let available = parts[1].trimmingCharacters(in: .whitespaces)

        return UpdateItem(
            id: "gem:\(name)",
            name: name,
            currentVersion: current,
            availableVersion: available,
            source: .gem
        )
    }

    // MARK: - Disk Version Detection

    /// Returns the latest installed version from Homebrew's Cellar, or "" if not found.
    /// Checks both Apple Silicon and Intel Homebrew paths.
    private nonisolated static func diskVersion() -> String {
        for cellarPath in ["/opt/homebrew/Cellar/legion-interlink",
                           "/usr/local/Cellar/legion-interlink"] {
            if let contents = try? FileManager.default.contentsOfDirectory(atPath: cellarPath) {
                let versions = contents.filter { !$0.hasPrefix(".") }.sorted()
                if let latest = versions.last { return latest }
            }
        }
        return ""
    }

    // MARK: - Process Helpers

    private nonisolated static func runSync(_ executable: String, arguments: [String]) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }

    deinit {
        backgroundTimer?.invalidate()
        diskVersionTimer?.invalidate()
    }
}

import Foundation

struct UpdatePreferences: Equatable {
    static let defaults = UpdatePreferences(
        autoUpdateGems: true,
        autoUpgradeCLI: true,
        restartDaemon: true
    )

    private enum Key {
        static let autoUpdateGems = "updates.autoUpdateGems"
        static let autoUpgradeCLI = "updates.autoUpgradeCLI"
        static let restartDaemon = "updates.restartDaemon"
    }

    let autoUpdateGems: Bool
    let autoUpgradeCLI: Bool
    let restartDaemon: Bool

    static func load(from defaults: UserDefaults = .standard) -> UpdatePreferences {
        UpdatePreferences(
            autoUpdateGems: value(forKey: Key.autoUpdateGems, from: defaults),
            autoUpgradeCLI: value(forKey: Key.autoUpgradeCLI, from: defaults),
            restartDaemon: value(forKey: Key.restartDaemon, from: defaults)
        )
    }

    func persist(to defaults: UserDefaults = .standard) {
        defaults.set(autoUpdateGems, forKey: Key.autoUpdateGems)
        defaults.set(autoUpgradeCLI, forKey: Key.autoUpgradeCLI)
        defaults.set(restartDaemon, forKey: Key.restartDaemon)
    }

    private static func value(forKey key: String, from defaults: UserDefaults) -> Bool {
        guard defaults.object(forKey: key) != nil else { return true }
        return defaults.bool(forKey: key)
    }
}

struct UpdateExecutionPlan: Equatable {
    let gemIDs: [String]
    let cliID: String?
    let interlinkID: String?

    var hasWork: Bool {
        !gemIDs.isEmpty || cliID != nil || interlinkID != nil
    }

    static func automatic(
        gemIDs: [String],
        cliID: String?,
        autoUpdateGems: Bool,
        autoUpgradeCLI: Bool
    ) -> UpdateExecutionPlan {
        UpdateExecutionPlan(
            gemIDs: autoUpdateGems ? gemIDs : [],
            cliID: autoUpgradeCLI ? cliID : nil,
            interlinkID: nil
        )
    }
}

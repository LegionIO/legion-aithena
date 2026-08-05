import XCTest
@testable import LegionInterlink

final class UpdatePolicyTests: XCTestCase {
    func testAutomaticPlanHonorsGemAndCLITogglesIndependently() {
        XCTAssertEqual(
            UpdateExecutionPlan.automatic(
                gemIDs: ["gem:lex-llm", "gem:legion-data"],
                cliID: "gem:legionio",
                autoUpdateGems: true,
                autoUpgradeCLI: false
            ),
            UpdateExecutionPlan(gemIDs: ["gem:lex-llm", "gem:legion-data"], cliID: nil, interlinkID: nil)
        )

        XCTAssertEqual(
            UpdateExecutionPlan.automatic(
                gemIDs: ["gem:lex-llm"],
                cliID: "gem:legionio",
                autoUpdateGems: false,
                autoUpgradeCLI: true
            ),
            UpdateExecutionPlan(gemIDs: [], cliID: "gem:legionio", interlinkID: nil)
        )
    }

    func testAutomaticPlanCombinesEnabledWorkIntoOneCycle() {
        let plan = UpdateExecutionPlan.automatic(
            gemIDs: ["gem:lex-llm"],
            cliID: "gem:legionio",
            autoUpdateGems: true,
            autoUpgradeCLI: true
        )

        XCTAssertEqual(
            plan,
            UpdateExecutionPlan(gemIDs: ["gem:lex-llm"], cliID: "gem:legionio", interlinkID: nil)
        )
        XCTAssertTrue(plan.hasWork)
    }

    func testUpdatePreferencesDefaultOnAndPersist() {
        let suiteName = "UpdatePolicyTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }

        XCTAssertEqual(UpdatePreferences.load(from: defaults), .defaults)

        let preferences = UpdatePreferences(
            autoUpdateGems: false,
            autoUpgradeCLI: true,
            restartDaemon: false
        )
        preferences.persist(to: defaults)

        XCTAssertEqual(UpdatePreferences.load(from: defaults), preferences)
    }
}

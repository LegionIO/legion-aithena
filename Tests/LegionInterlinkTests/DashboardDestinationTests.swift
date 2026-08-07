import XCTest
@testable import LegionInterlink

final class DashboardDestinationTests: XCTestCase {
    func testDestinationTitlesAreInSidebarOrder() {
        XCTAssertEqual(
            DashboardDestination.allCases.map(\.title),
            [
                "Routing",
                "Services",
                "Logs",
                "Identity",
                "LLM",
                "GAIA",
                "MCP",
                "Extensions",
                "Workers",
                "Updates",
                "Settings"
            ]
        )
    }

    func testRoutingIsTheDefaultDestination() {
        XCTAssertEqual(DashboardDestination.defaultDestination, .routing)
    }

    func testUpdateBadgeIsVisibleOnlyAfterSuccessfulCheckWithUpdates() {
        XCTAssertNil(UpdateBadgeState.visibleCount(hasChecked: false, outdatedCount: 3))
        XCTAssertNil(UpdateBadgeState.visibleCount(hasChecked: true, outdatedCount: 0))
        XCTAssertEqual(UpdateBadgeState.visibleCount(hasChecked: true, outdatedCount: 3), 3)
    }
}

import XCTest
@testable import LegionInterlink

final class InstalledGemParserTests: XCTestCase {
    func testParsesSingleVersion() {
        let gems = InstalledGemParser.parse("lex-llm (0.6.16)")

        XCTAssertEqual(gems, [InstalledGem(id: "lex-llm", name: "lex-llm", version: "0.6.16")])
    }

    func testMultipleVersionsSelectsFirstVersion() {
        let gems = InstalledGemParser.parse("lex-llm (0.6.16, 0.6.15)")

        XCTAssertEqual(gems.first?.version, "0.6.16")
    }

    func testTrimsLineAndVersionWhitespace() {
        let gems = InstalledGemParser.parse("  lex-llm ( 0.6.16 , 0.6.15 )  ")

        XCTAssertEqual(gems, [InstalledGem(id: "lex-llm", name: "lex-llm", version: "0.6.16")])
    }

    func testIgnoresMalformedAndNonLexLines() {
        let gems = InstalledGemParser.parse("""
        *** LOCAL GEMS ***
        rake (13.2.1)
        lex-missing-version
        lex-empty ()
        lex-valid (1.2.3)
        """)

        XCTAssertEqual(gems, [InstalledGem(id: "lex-valid", name: "lex-valid", version: "1.2.3")])
    }

    func testResolverPrefersValidReportedVersion() {
        XCTAssertEqual(
            InstalledGemParser.resolveVersion(reported: " 2.0.0 ", installed: "1.0.0"),
            "2.0.0"
        )
    }

    func testResolverFallsBackForBlankAndPlaceholderReportedVersions() {
        XCTAssertEqual(InstalledGemParser.resolveVersion(reported: "  ", installed: "1.0.0"), "1.0.0")
        XCTAssertEqual(InstalledGemParser.resolveVersion(reported: " - ", installed: "1.0.0"), "1.0.0")
        XCTAssertEqual(InstalledGemParser.resolveVersion(reported: " — ", installed: "1.0.0"), "1.0.0")
    }

    func testResolverReturnsNilWhenBothVersionsAreUnknown() {
        XCTAssertNil(InstalledGemParser.resolveVersion(reported: "—", installed: nil))
        XCTAssertNil(InstalledGemParser.resolveVersion(reported: nil, installed: " - "))
    }
}

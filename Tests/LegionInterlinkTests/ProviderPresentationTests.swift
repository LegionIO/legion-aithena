import XCTest
@testable import LegionInterlink

final class ProviderPresentationTests: XCTestCase {
    func testProviderInstanceKeyIncludesBothIdentityParts() {
        let first = ProviderInstanceKey(provider: "bedrock", instance: "env_bearer")
        let second = ProviderInstanceKey(provider: "bedrock", instance: "claude")

        XCTAssertNotEqual(first, second)
        XCTAssertNotEqual(first.id, second.id)
        XCTAssertEqual(first.id, first.rawValue)
    }

    func testProviderInstanceKeyDoesNotCollideWhenIdentityPartsContainSeparators() {
        let first = ProviderInstanceKey(provider: "a:b", instance: "c")
        let second = ProviderInstanceKey(provider: "a", instance: "b:c")

        XCTAssertNotEqual(first.rawValue, second.rawValue)
    }

    func testEqualCanonicallyEquivalentKeysHaveEqualIDs() {
        let composed = ProviderInstanceKey(provider: "caf\u{00E9}", instance: "prod")
        let decomposed = ProviderInstanceKey(provider: "cafe\u{0301}", instance: "prod")

        XCTAssertEqual(composed, decomposed)
        XCTAssertEqual(composed.id, decomposed.id)
    }

    func testProviderModelRequestScopesAndEncodesTheProviderInstance() {
        let key = ProviderInstanceKey(provider: "bedrock/aws prod", instance: "env bearer")

        XCTAssertEqual(key.modelsPath, "/api/llm/providers/bedrock%2Faws%20prod/models")
        XCTAssertEqual(key.modelsQuery, ["instance": "env bearer"])
    }

    func testCircuitStatesMapOnlyExactAPIValues() {
        XCTAssertEqual(ProviderCircuitState(rawValue: "closed"), .closed)
        XCTAssertEqual(ProviderCircuitState(rawValue: "half_open"), .halfOpen)
        XCTAssertEqual(ProviderCircuitState(rawValue: "open"), .open)
        XCTAssertEqual(ProviderCircuitState(rawValue: nil), .unknown)
        XCTAssertEqual(ProviderCircuitState(rawValue: ""), .unknown)
        XCTAssertEqual(ProviderCircuitState(rawValue: "available"), .unknown)
    }

    func testCircuitLabelsRemainExact() {
        XCTAssertEqual(ProviderCircuitState.closed.label, "closed")
        XCTAssertEqual(ProviderCircuitState.halfOpen.label, "half-open")
        XCTAssertEqual(ProviderCircuitState.open.label, "open")
        XCTAssertEqual(ProviderCircuitState.unknown.label, "unknown")
    }

    func testCachedProviderParsesCircuitStateFromHealthPayload() {
        let provider = DaemonCache.parseLLMProvider([
            "provider": "bedrock",
            "instance": "env_bearer",
            "tier": "cloud",
            "capabilities": ["inference"],
            "health": ["circuit_state": "half_open"]
        ])

        XCTAssertEqual(provider?.circuitState, .halfOpen)
        XCTAssertEqual(
            provider?.key,
            ProviderInstanceKey(provider: "bedrock", instance: "env_bearer")
        )
    }
}

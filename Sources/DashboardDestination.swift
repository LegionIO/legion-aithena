enum DashboardDestination: String, CaseIterable, Identifiable {
    case routing
    case services
    case logs
    case identity
    case llm
    case gaia
    case mcp
    case extensions
    case workers
    case updates
    case settings

    static let defaultDestination: DashboardDestination = .routing

    var id: String { rawValue }

    var title: String {
        switch self {
        case .routing: "Routing"
        case .services: "Services"
        case .logs: "Logs"
        case .identity: "Identity"
        case .llm: "LLM"
        case .gaia: "GAIA"
        case .mcp: "MCP"
        case .extensions: "Extensions"
        case .workers: "Workers"
        case .updates: "Updates"
        case .settings: "Settings"
        }
    }

    var icon: String {
        switch self {
        case .routing: "arrow.triangle.branch"
        case .services: "server.rack"
        case .logs: "terminal"
        case .identity: "person.badge.key"
        case .llm: "brain"
        case .gaia: "bubble.left.and.bubble.right"
        case .mcp: "link.circle"
        case .extensions: "puzzlepiece.extension"
        case .workers: "gearshape.2"
        case .updates: "arrow.triangle.2.circlepath"
        case .settings: "gearshape"
        }
    }
}

enum UpdateBadgeState {
    static func visibleCount(hasChecked: Bool, outdatedCount: Int) -> Int? {
        guard hasChecked, outdatedCount > 0 else { return nil }
        return outdatedCount
    }
}

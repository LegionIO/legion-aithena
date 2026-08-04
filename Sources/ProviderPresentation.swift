import Foundation

struct ProviderInstanceKey: Hashable, Identifiable {
    let provider: String
    let instance: String

    var id: String { rawValue }

    var rawValue: String {
        let normalizedProvider = provider.precomposedStringWithCanonicalMapping
        let normalizedInstance = instance.precomposedStringWithCanonicalMapping
        return "p\(normalizedProvider.utf8.count):\(normalizedProvider)i\(normalizedInstance.utf8.count):\(normalizedInstance)"
    }

    var modelsPath: String {
        var pathSegmentAllowed = CharacterSet.urlPathAllowed
        pathSegmentAllowed.remove(charactersIn: "/")
        let encodedProvider = provider.addingPercentEncoding(withAllowedCharacters: pathSegmentAllowed) ?? ""
        var components = URLComponents()
        components.percentEncodedPath = "/api/llm/providers/\(encodedProvider)/models"
        return components.percentEncodedPath
    }

    var modelsQuery: [String: String] {
        ["instance": instance]
    }
}

enum ProviderCircuitState: Equatable {
    case closed
    case halfOpen
    case open
    case unknown

    init(rawValue: String?) {
        switch rawValue {
        case "closed":
            self = .closed
        case "half_open":
            self = .halfOpen
        case "open":
            self = .open
        default:
            self = .unknown
        }
    }

    var label: String {
        switch self {
        case .closed:
            return "closed"
        case .halfOpen:
            return "half-open"
        case .open:
            return "open"
        case .unknown:
            return "unknown"
        }
    }
}

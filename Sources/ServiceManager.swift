import Foundation
import SwiftUI

// MARK: - Service Definitions

enum ServiceName: String, CaseIterable, Identifiable {
    case legionio
    case redis
    case memcached
    case ollama

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .legionio:  return "LegionIO Daemon"
        case .redis:     return "Redis"
        case .memcached: return "Memcached"
        case .ollama:    return "Ollama"
        }
    }

    var brewName: String { rawValue }
}

enum ServiceStatus: String {
    case running  = "Running"
    case stopped  = "Stopped"
    case starting = "Starting"
    case unknown  = "Checking..."
}

struct ServiceState: Identifiable {
    let name: ServiceName
    var status: ServiceStatus
    var pid: Int?

    var id: String { name.rawValue }
}

// MARK: - Daemon Readiness

struct DaemonReadiness {
    var ready: Bool = false
    var components: [String: Bool] = [:]
}

// MARK: - Overall Status

enum OverallStatus {
    case online
    case offline
    case setupNeeded
    case checking
}

// MARK: - ServiceManager

@MainActor
class ServiceManager: ObservableObject {
    static let shared = ServiceManager()

    @Published var services: [ServiceState] = ServiceName.allCases.map {
        ServiceState(name: $0, status: .unknown)
    }
    @Published var daemonReadiness = DaemonReadiness()
    @Published var overallStatus: OverallStatus = .checking
    @Published var lastChecked: Date?
    @Published var logContents: String = ""
    @Published var errorLogContents: String = ""
    @Published var setupNeeded: Bool = false

    private let daemonHealthURL = URL(string: "http://localhost:4567/api/ready")!
    private let logPath = "/opt/homebrew/var/log/legion/legion.log"
    private let agenticMarkerPath: String
    private var timer: Timer?

    /// Resolved once at init — no repeated filesystem checks.
    private let resolvedBrewPath: String
    private let resolvedLegionioPath: String

    private static func findBrewPath() -> String {
        if FileManager.default.isExecutableFile(atPath: "/opt/homebrew/bin/brew") {
            return "/opt/homebrew/bin/brew"
        }
        return "/usr/local/bin/brew"
    }

    private static func findLegionioPath() -> String {
        if FileManager.default.isExecutableFile(atPath: "/opt/homebrew/bin/legionio") {
            return "/opt/homebrew/bin/legionio"
        }
        return "/usr/local/bin/legionio"
    }

    init() {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        self.agenticMarkerPath = "\(home)/.legionio/.packs/agentic"
        self.resolvedBrewPath = Self.findBrewPath()
        self.resolvedLegionioPath = Self.findLegionioPath()
        checkSetupNeeded()
        startPolling()
    }

    // MARK: - Setup Detection

    func checkSetupNeeded() {
        setupNeeded = !FileManager.default.fileExists(atPath: agenticMarkerPath)
    }

    // MARK: - Service Control (all async, off main thread)

    func startAll() {
        for service in ServiceName.allCases {
            startService(service)
        }
    }

    func stopAll() {
        // Stop legionio first, then infrastructure
        stopService(.legionio)
        for service in ServiceName.allCases where service != .legionio {
            stopService(service)
        }
    }

    func startService(_ service: ServiceName) {
        updateServiceStatus(service, .starting)
        let brew = resolvedBrewPath
        let legionio = resolvedLegionioPath
        let name = service.brewName
        Task.detached {
            if service == .legionio {
                // Ensure brew services isn't managing legionio (it gets stuck)
                Self.runProcess(brew, arguments: ["services", "stop", "legionio"])
                // Use legionio's own start command
                Self.runProcess(legionio, arguments: ["start"])
            } else {
                Self.runProcess(brew, arguments: ["services", "start", name])
            }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            await self.checkAllServices()
        }
    }

    func stopService(_ service: ServiceName) {
        let brew = resolvedBrewPath
        let legionio = resolvedLegionioPath
        let name = service.brewName
        Task.detached {
            if service == .legionio {
                // Stop via legionio CLI, and also ensure brew services releases it
                Self.runProcess(legionio, arguments: ["stop"])
                Self.runProcess(brew, arguments: ["services", "stop", "legionio"])
            } else {
                Self.runProcess(brew, arguments: ["services", "stop", name])
            }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            await self.checkAllServices()
        }
    }

    func restartDaemon() {
        updateServiceStatus(.legionio, .starting)
        let brew = resolvedBrewPath
        let legionio = resolvedLegionioPath
        Task.detached {
            // Stop everything related to legionio
            Self.runProcess(legionio, arguments: ["stop"])
            Self.runProcess(brew, arguments: ["services", "stop", "legionio"])
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            // Start via legionio CLI
            Self.runProcess(legionio, arguments: ["start"])
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await self.checkAllServices()
        }
    }

    // MARK: - Health Checks

    func checkAllServices() async {
        let brew = resolvedBrewPath

        // Run all health checks concurrently off the main thread
        async let redisResult = Self.checkBrewService(brew: brew, name: ServiceName.redis.brewName)
        async let memcachedResult = Self.checkBrewService(brew: brew, name: ServiceName.memcached.brewName)
        async let ollamaResult = Self.checkBrewService(brew: brew, name: ServiceName.ollama.brewName)
        async let daemonResult = Self.checkDaemonHealth(url: daemonHealthURL)

        let redis = await redisResult
        let memcached = await memcachedResult
        let ollama = await ollamaResult
        let daemon = await daemonResult

        // Update UI on main actor (we're already @MainActor)
        updateServiceStatus(.redis, redis.running ? .running : .stopped, pid: redis.pid)
        updateServiceStatus(.memcached, memcached.running ? .running : .stopped, pid: memcached.pid)
        updateServiceStatus(.ollama, ollama.running ? .running : .stopped, pid: ollama.pid)

        daemonReadiness = daemon.readiness
        updateServiceStatus(.legionio, daemon.readiness.ready ? .running : .stopped)

        lastChecked = Date()
        recalculateOverallStatus()
    }

    func refreshLogs() {
        let path = logPath
        Task.detached {
            let content = Self.tailFile(path: path, lines: 200)
            await MainActor.run { self.logContents = content }
        }
    }

    // MARK: - Process Execution (for onboarding)

    nonisolated func runCommand(_ executable: String, arguments: [String]) async -> (output: String, success: Bool) {
        await withCheckedContinuation { continuation in
            let process = Process()
            let pipe = Pipe()

            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
            process.standardOutput = pipe
            process.standardError = pipe

            do {
                try process.run()
                process.waitUntilExit()

                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                let output = String(data: data, encoding: .utf8) ?? ""
                continuation.resume(returning: (output, process.terminationStatus == 0))
            } catch {
                continuation.resume(returning: (error.localizedDescription, false))
            }
        }
    }

    /// Run a command and stream output line-by-line to a callback.
    nonisolated func runCommandStreaming(_ executable: String, arguments: [String], onLine: @escaping @Sendable (String) -> Void) async -> Bool {
        await withCheckedContinuation { continuation in
            let process = Process()
            let pipe = Pipe()

            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
            process.standardOutput = pipe
            process.standardError = pipe

            pipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                guard !data.isEmpty else { return }
                if let line = String(data: data, encoding: .utf8) {
                    onLine(line)
                }
            }

            do {
                try process.run()
                process.waitUntilExit()
                pipe.fileHandleForReading.readabilityHandler = nil
                continuation.resume(returning: process.terminationStatus == 0)
            } catch {
                pipe.fileHandleForReading.readabilityHandler = nil
                continuation.resume(returning: false)
            }
        }
    }

    // MARK: - Static helpers (run off main thread)

    /// Run a brew command synchronously. Call from Task.detached only.
    private nonisolated static func runProcess(_ executable: String, arguments: [String]) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try? process.run()
        process.waitUntilExit()
    }

    /// Check a brew service status. Runs entirely off main thread.
    private nonisolated static func checkBrewService(brew: String, name: String) async -> (running: Bool, pid: Int?) {
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: brew)
        process.arguments = ["services", "info", name, "--json"]
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return (false, nil)
        }

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let first = json.first else {
            return (false, nil)
        }

        let running = first["running"] as? Bool ?? false
        let pid = first["pid"] as? Int
        return (running, pid)
    }

    /// Check daemon health via HTTP. Runs entirely off main thread.
    private nonisolated static func checkDaemonHealth(url: URL) async -> (readiness: DaemonReadiness, running: Bool) {
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let payload = json["data"] as? [String: Any] ?? json
                let ready = payload["ready"] as? Bool ?? false
                var components: [String: Bool] = [:]
                if let comps = payload["components"] as? [String: Bool] {
                    components = comps
                }
                return (DaemonReadiness(ready: ready, components: components), ready)
            }
        } catch {
            // Connection refused / timeout — daemon is down
        }
        return (DaemonReadiness(), false)
    }

    /// Read the tail of a log file. Runs off main thread.
    private nonisolated static func tailFile(path: String, lines: Int) -> String {
        // Use the tail command for efficiency — avoids reading entire file into memory
        let process = Process()
        let pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/tail")
        process.arguments = ["-n", "\(lines)", path]
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            return String(data: data, encoding: .utf8) ?? "(unable to read log)"
        } catch {
            return "(no log file found at \(path))"
        }
    }

    // MARK: - Private Helpers

    private func updateServiceStatus(_ service: ServiceName, _ status: ServiceStatus, pid: Int? = nil) {
        if let idx = services.firstIndex(where: { $0.name == service }) {
            services[idx].status = status
            if let pid { services[idx].pid = pid }
        }
    }

    private func recalculateOverallStatus() {
        if setupNeeded {
            overallStatus = .setupNeeded
            return
        }

        let legionService = services.first(where: { $0.name == .legionio })
        if legionService?.status == .running {
            overallStatus = .online
        } else if services.map(\.status).contains(.unknown) {
            overallStatus = .checking
        } else {
            overallStatus = .offline
        }
    }

    private func startPolling() {
        Task { await checkAllServices() }
        refreshLogs()
        timer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                await self.checkAllServices()
                self.refreshLogs()
            }
        }
    }

    deinit {
        timer?.invalidate()
    }
}

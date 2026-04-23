import SwiftUI
import AppKit

// MARK: - Dark Terminal Theme

private enum TerminalTheme {
    static let bg = Color(red: 0.08, green: 0.08, blue: 0.10)
    static let surfaceBg = Color(red: 0.11, green: 0.11, blue: 0.14)
    static let cardBg = Color(red: 0.14, green: 0.14, blue: 0.17)
    static let border = Color.white.opacity(0.08)
    static let text = Color(red: 0.88, green: 0.88, blue: 0.90)
    static let textDim = Color(red: 0.55, green: 0.55, blue: 0.58)
    static let accent = Color(red: 0.56, green: 0.50, blue: 0.92)
    static let green = Color(red: 0.30, green: 0.85, blue: 0.45)
    static let red = Color(red: 0.95, green: 0.35, blue: 0.35)
    static let yellow = Color(red: 0.95, green: 0.80, blue: 0.25)
    static let gray = Color(red: 0.45, green: 0.45, blue: 0.48)
}

// MARK: - Chat Message Model

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: String // "user" or "assistant"
    let content: String
    let timestamp: Date
}

// MARK: - Pulsing Status Text

private struct PulsingStatusText: View {
    let status: ServiceStatus
    @State private var pulse = false

    private var isTransitioning: Bool {
        status == .starting || status == .stopping
    }

    private var color: Color {
        switch status {
        case .running:  return TerminalTheme.green
        case .stopped:  return TerminalTheme.red
        case .starting: return TerminalTheme.yellow
        case .stopping: return TerminalTheme.yellow
        case .unknown:  return TerminalTheme.gray
        }
    }

    var body: some View {
        Text(status.rawValue.lowercased())
            .font(.system(size: 10, design: .monospaced))
            .foregroundColor(color)
            .opacity(isTransitioning && pulse ? 0.3 : 1.0)
            .onAppear {
                if isTransitioning {
                    withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) {
                        pulse = true
                    }
                }
            }
            .onChange(of: status) { newStatus in
                let transitioning = newStatus == .starting || newStatus == .stopping
                if transitioning {
                    pulse = false
                    withAnimation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true)) {
                        pulse = true
                    }
                } else {
                    withAnimation(.default) {
                        pulse = false
                    }
                }
            }
    }
}

// MARK: - Status Window View

struct StatusWindowView: View {
    @EnvironmentObject var manager: ServiceManager
    @State private var selectedTab = 0
    @State private var hasAppeared = false

    private static let tabChat = 0
    private static let tabLogs = 1
    private static let tabServices = 2

    var body: some View {
        VStack(spacing: 0) {
            // Title bar area
            titleBar

            // Tab bar
            tabBar

            // Tab content
            Group {
                switch selectedTab {
                case Self.tabChat: ChatTab()
                case Self.tabLogs: LogsTab()
                case Self.tabServices: ServicesTab()
                default: ChatTab()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(TerminalTheme.bg)
        .frame(minWidth: 700, minHeight: 520)
        .preferredColorScheme(.dark)
        .onAppear {
            if !hasAppeared {
                hasAppeared = true
                if manager.overallStatus != .online {
                    selectedTab = Self.tabServices
                }
            }
        }
    }

    // MARK: - Grid Icon (matches menu bar icon)

    private static func gridIcon(size: CGFloat, color: NSColor) -> NSImage {
        let image = NSImage(size: NSSize(width: size, height: size), flipped: false) { rect in
            let s = rect.width
            let padding: CGFloat = s * 0.1
            let gridSize = s - padding * 2
            let step = gridSize / 2

            var points: [NSPoint] = []
            for row in 0..<3 {
                for col in 0..<3 {
                    points.append(NSPoint(
                        x: padding + CGFloat(col) * step,
                        y: padding + CGFloat(row) * step
                    ))
                }
            }

            let connections: [(Int, Int)] = [
                (0, 1), (1, 2), (3, 4), (4, 5), (6, 7), (7, 8),
                (0, 3), (3, 6), (1, 4), (4, 7), (2, 5), (5, 8),
                (1, 3), (1, 5), (3, 7), (5, 7),
            ]

            color.withAlphaComponent(0.45).setStroke()
            for (a, b) in connections {
                let path = NSBezierPath()
                path.move(to: points[a])
                path.line(to: points[b])
                path.lineWidth = s * 0.045
                path.stroke()
            }

            let nodeRadius = s * 0.095
            for (i, p) in points.enumerated() {
                let isCenter = (i == 4)
                let r = isCenter ? nodeRadius * 1.4 : nodeRadius
                color.setFill()
                NSBezierPath(ovalIn: NSRect(
                    x: p.x - r, y: p.y - r,
                    width: r * 2, height: r * 2
                )).fill()
            }
            return true
        }
        return image
    }

    // MARK: - Title Bar

    private var titleBar: some View {
        HStack(spacing: 10) {
            Image(nsImage: Self.gridIcon(
                size: 18,
                color: NSColor(TerminalTheme.accent)
            ))

            (Text("Legion")
                .foregroundColor(TerminalTheme.accent)
            + Text("IO")
                .foregroundColor(TerminalTheme.text))
                .font(.system(size: 14, weight: .semibold, design: .monospaced))

            statusPill

            Spacer()

            if let lastChecked = manager.lastChecked {
                Text(lastChecked, style: .time)
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(TerminalTheme.textDim)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(TerminalTheme.surfaceBg)
    }

    private var statusPill: some View {
        let color: Color = {
            switch manager.overallStatus {
            case .online: return TerminalTheme.green
            case .offline: return TerminalTheme.red
            case .setupNeeded: return TerminalTheme.yellow
            case .checking: return TerminalTheme.gray
            }
        }()

        return HStack(spacing: 5) {
            Circle()
                .fill(color)
                .frame(width: 7, height: 7)
                .shadow(color: color.opacity(0.6), radius: 3)

            Text(manager.overallStatus.displayText.uppercased())
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundColor(color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
        .cornerRadius(4)
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabButton(title: "Chat", icon: "bubble.left.and.bubble.right", index: 0)
            tabButton(title: "Logs", icon: "terminal", index: 1)
            tabButton(title: "Services", icon: "server.rack", index: 2)
            Spacer()
        }
        .background(TerminalTheme.bg)
        .overlay(
            Rectangle()
                .fill(TerminalTheme.border)
                .frame(height: 1),
            alignment: .bottom
        )
    }

    private func tabButton(title: String, icon: String, index: Int) -> some View {
        let isSelected = selectedTab == index
        return Button(action: { selectedTab = index }) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 11))
                Text(title)
                    .font(.system(size: 12, weight: isSelected ? .semibold : .regular, design: .monospaced))
            }
            .foregroundColor(isSelected ? TerminalTheme.accent : TerminalTheme.textDim)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isSelected ? TerminalTheme.surfaceBg : Color.clear)
            .overlay(
                Rectangle()
                    .fill(isSelected ? TerminalTheme.accent : Color.clear)
                    .frame(height: 2),
                alignment: .bottom
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Services Tab

struct ServicesTab: View {
    @EnvironmentObject var manager: ServiceManager

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Service Cards
                ForEach(manager.services) { service in
                    if service.name == .legionio {
                        daemonCard(service)
                    } else {
                        serviceCard(service)
                    }
                }
            }
            .padding(16)
        }
        .background(TerminalTheme.bg)
    }

    // MARK: - Daemon Card (LegionIO with components)

    private func daemonCard(_ service: ServiceState) -> some View {
        VStack(spacing: 0) {
            // Main service row
            HStack(spacing: 12) {
                statusDot(service.status)

                VStack(alignment: .leading, spacing: 2) {
                    Text(service.name.displayName)
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundColor(TerminalTheme.text)

                    HStack(spacing: 8) {
                        statusText(service.status)

                        if let pid = service.pid {
                            Text("pid:\(String(pid))")
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundColor(TerminalTheme.textDim)
                        }
                    }
                }

                Spacer()

                // Control buttons: start/stop
                HStack(spacing: 6) {
                    if service.status == .stopping || service.status == .starting {
                        // No button while transitioning
                    } else if service.status == .running {
                        terminalButton("stop", color: TerminalTheme.red) {
                            manager.stopService(service.name)
                        }
                    } else {
                        terminalButton("start", color: TerminalTheme.green) {
                            manager.startService(service.name)
                        }
                    }
                }
            }
            .padding(12)

            // Daemon Components (inline)
            if service.status == .running && !manager.daemonReadiness.components.isEmpty {
                Rectangle()
                    .fill(TerminalTheme.border)
                    .frame(height: 1)
                    .padding(.horizontal, 12)

                VStack(alignment: .leading, spacing: 6) {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 120), spacing: 4)
                    ], spacing: 4) {
                        ForEach(
                            manager.daemonReadiness.components.sorted(by: { $0.key < $1.key }),
                            id: \.key
                        ) { component, ready in
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(ready ? TerminalTheme.green : TerminalTheme.yellow)
                                    .frame(width: 5, height: 5)
                                Text(component)
                                    .font(.system(size: 9, design: .monospaced))
                                    .foregroundColor(TerminalTheme.textDim)
                                Spacer()
                            }
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
            }
        }
        .background(TerminalTheme.cardBg)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(TerminalTheme.border, lineWidth: 1)
        )
        .cornerRadius(6)
    }

    // MARK: - Standard Service Card

    private func serviceCard(_ service: ServiceState) -> some View {
        HStack(spacing: 12) {
            // Status indicator
            statusDot(service.status)

            // Service info
            VStack(alignment: .leading, spacing: 2) {
                Text(service.name.displayName)
                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                    .foregroundColor(TerminalTheme.text)

                HStack(spacing: 8) {
                    statusText(service.status)

                    if let pid = service.pid {
                        Text("pid:\(String(pid))")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundColor(TerminalTheme.textDim)
                    }
                }
            }

            Spacer()

            // Control button
            if service.status == .stopping || service.status == .starting {
                // No button while transitioning
            } else if service.status == .running {
                terminalButton("stop", color: TerminalTheme.red) {
                    manager.stopService(service.name)
                }
            } else {
                terminalButton("start", color: TerminalTheme.green) {
                    manager.startService(service.name)
                }
            }
        }
        .padding(12)
        .background(TerminalTheme.cardBg)
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(TerminalTheme.border, lineWidth: 1)
        )
        .cornerRadius(6)
    }

    private func statusDot(_ status: ServiceStatus) -> some View {
        let color = statusColor(status)
        return ZStack {
            Circle()
                .fill(color.opacity(0.2))
                .frame(width: 20, height: 20)
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
                .shadow(color: color.opacity(0.5), radius: 4)
        }
    }

    private func statusColor(_ status: ServiceStatus) -> Color {
        switch status {
        case .running:  return TerminalTheme.green
        case .stopped:  return TerminalTheme.red
        case .starting: return TerminalTheme.yellow
        case .stopping: return TerminalTheme.yellow
        case .unknown:  return TerminalTheme.gray
        }
    }

    private func statusText(_ status: ServiceStatus) -> some View {
        PulsingStatusText(status: status)
    }

    private func terminalButton(_ label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundColor(color)
                .frame(minWidth: 40)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(color.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
                .cornerRadius(4)
        }
        .buttonStyle(.plain)
    }

}

// MARK: - Chat Tab

struct ChatTab: View {
    @EnvironmentObject var manager: ServiceManager
    @State private var messages: [ChatMessage] = []
    @State private var inputText: String = ""
    @State private var isStreaming = false

    var body: some View {
        VStack(spacing: 0) {
            // Messages area
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if messages.isEmpty {
                            emptyState
                        }
                        ForEach(messages) { message in
                            chatBubble(message)
                        }
                        if isStreaming {
                            streamingIndicator
                        }
                    }
                    .padding(16)
                    .id("chatBottom")
                }
                .onChange(of: messages.count) { _ in
                    withAnimation {
                        proxy.scrollTo("chatBottom", anchor: .bottom)
                    }
                }
            }
            .background(TerminalTheme.bg)

            // Input bar
            inputBar
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer().frame(height: 60)
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 32))
                .foregroundColor(TerminalTheme.accent.opacity(0.4))
            Text("Chat with Legion")
                .font(.system(size: 14, weight: .medium, design: .monospaced))
                .foregroundColor(TerminalTheme.textDim)
            Text("Send a message to the LLM inference endpoint")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(TerminalTheme.textDim.opacity(0.6))
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func chatBubble(_ message: ChatMessage) -> some View {
        HStack(alignment: .top, spacing: 8) {
            // Role indicator
            Text(message.role == "user" ? ">" : "$")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundColor(message.role == "user" ? TerminalTheme.accent : TerminalTheme.green)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 4) {
                Text(message.role == "user" ? "you" : "legion")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
                    .foregroundColor(message.role == "user" ? TerminalTheme.accent : TerminalTheme.green)
                    .textCase(.uppercase)

                Text(message.content)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(TerminalTheme.text)
                    .textSelection(.enabled)
            }

            Spacer()
        }
        .padding(10)
        .background(
            message.role == "user"
                ? TerminalTheme.accent.opacity(0.05)
                : TerminalTheme.green.opacity(0.03)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 6)
                .stroke(
                    message.role == "user"
                        ? TerminalTheme.accent.opacity(0.15)
                        : TerminalTheme.green.opacity(0.1),
                    lineWidth: 1
                )
        )
        .cornerRadius(6)
    }

    private var streamingIndicator: some View {
        HStack(spacing: 8) {
            Text("$")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .foregroundColor(TerminalTheme.green)
                .frame(width: 16)

            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(TerminalTheme.green)
                        .frame(width: 4, height: 4)
                        .opacity(0.6)
                }
            }

            Spacer()
        }
        .padding(10)
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            Text(">")
                .font(.system(size: 14, weight: .bold, design: .monospaced))
                .foregroundColor(TerminalTheme.accent)

            TextField("Send a message...", text: $inputText)
                .textFieldStyle(.plain)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(TerminalTheme.text)
                .onSubmit { sendMessage() }
                .disabled(isStreaming)

            if isStreaming {
                ProgressView()
                    .controlSize(.small)
                    .scaleEffect(0.7)
            } else {
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(inputText.isEmpty ? TerminalTheme.textDim : TerminalTheme.accent)
                }
                .buttonStyle(.plain)
                .disabled(inputText.isEmpty)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(TerminalTheme.surfaceBg)
        .overlay(
            Rectangle()
                .fill(TerminalTheme.border)
                .frame(height: 1),
            alignment: .top
        )
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        let userMessage = ChatMessage(role: "user", content: text, timestamp: Date())
        messages.append(userMessage)
        inputText = ""
        isStreaming = true

        Task {
            let response = await callInferenceAPI(prompt: text)
            await MainActor.run {
                let assistantMessage = ChatMessage(
                    role: "assistant",
                    content: response,
                    timestamp: Date()
                )
                messages.append(assistantMessage)
                isStreaming = false
            }
        }
    }

    private func callInferenceAPI(prompt: String) async -> String {
        let url = URL(string: "http://localhost:\(ServiceManager.daemonPort)/api/llm/inference")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 120

        // Build conversation history for context
        var conversationMessages: [[String: String]] = []
        for msg in messages {
            conversationMessages.append([
                "role": msg.role,
                "content": msg.content
            ])
        }
        // Add the current prompt
        conversationMessages.append(["role": "user", "content": prompt])

        let body: [String: Any] = [
            "messages": conversationMessages,
            "prompt": prompt
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)

            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    // Try common response shapes
                    if let dataObj = json["data"] as? [String: Any] {
                        if let content = dataObj["content"] as? String { return content }
                        if let text = dataObj["text"] as? String { return text }
                        if let response = dataObj["response"] as? String { return response }
                        if let message = dataObj["message"] as? String { return message }
                    }
                    if let content = json["content"] as? String { return content }
                    if let text = json["text"] as? String { return text }
                    if let response = json["response"] as? String { return response }
                    if let message = json["message"] as? String { return message }

                    // Fallback: return raw JSON
                    if let prettyData = try? JSONSerialization.data(withJSONObject: json, options: .prettyPrinted),
                       let prettyString = String(data: prettyData, encoding: .utf8) {
                        return prettyString
                    }
                }

                // Fallback: return raw text
                if let text = String(data: data, encoding: .utf8), !text.isEmpty {
                    return text
                }
            } else if let httpResponse = response as? HTTPURLResponse {
                return "[error] HTTP \(httpResponse.statusCode)"
            }
        } catch let error as URLError where error.code == .cannotConnectToHost {
            return "[error] daemon is not running — start the LegionIO daemon first"
        } catch {
            return "[error] \(error.localizedDescription)"
        }

        return "[error] unexpected response"
    }
}

// MARK: - Logs Tab

struct LogsTab: View {
    @EnvironmentObject var manager: ServiceManager
    @State private var autoScroll = true

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack(spacing: 12) {
                Image(systemName: "terminal")
                    .font(.system(size: 11))
                    .foregroundColor(TerminalTheme.accent)

                Text("DAEMON LOG")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundColor(TerminalTheme.textDim)

                Text("— /opt/homebrew/var/log/legion/legion.log")
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(TerminalTheme.textDim.opacity(0.5))

                Spacer()

                Toggle(isOn: $autoScroll) {
                    Text("auto-scroll")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(TerminalTheme.textDim)
                }
                .toggleStyle(.checkbox)
                .controlSize(.small)

                Button(action: { manager.logContents = "" }) {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark.circle")
                            .font(.system(size: 10))
                        Text("clear")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                    }
                    .foregroundColor(TerminalTheme.textDim)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(TerminalTheme.textDim.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 3)
                            .stroke(TerminalTheme.textDim.opacity(0.2), lineWidth: 1)
                    )
                    .cornerRadius(3)
                }
                .buttonStyle(.plain)

                Button(action: manager.refreshLogs) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10))
                        Text("refresh")
                            .font(.system(size: 9, weight: .medium, design: .monospaced))
                    }
                    .foregroundColor(TerminalTheme.accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(TerminalTheme.accent.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 3)
                            .stroke(TerminalTheme.accent.opacity(0.2), lineWidth: 1)
                    )
                    .cornerRadius(3)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(TerminalTheme.surfaceBg)
            .overlay(
                Rectangle()
                    .fill(TerminalTheme.border)
                    .frame(height: 1),
                alignment: .bottom
            )

            // Log content
            ScrollViewReader { proxy in
                ScrollView([.horizontal, .vertical]) {
                    Text(manager.logContents.isEmpty ? "waiting for log output..." : manager.logContents)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(
                            manager.logContents.isEmpty
                                ? TerminalTheme.textDim
                                : TerminalTheme.green.opacity(0.85)
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                        .padding(12)
                        .id("logEnd")
                }
                .background(TerminalTheme.bg)
                .onChange(of: manager.logContents) { _ in
                    if autoScroll {
                        proxy.scrollTo("logEnd", anchor: .bottom)
                    }
                }
            }
        }
    }
}

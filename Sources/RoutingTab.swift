import SwiftUI

// MARK: - Routing Tab

struct RoutingTab: View {
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ClientRoutingSection()

                Rectangle()
                    .fill(TerminalTheme.border)
                    .frame(height: 1)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)

                LLMProvidersSection()
            }
        }
        .background(TerminalTheme.bg)
    }
}
